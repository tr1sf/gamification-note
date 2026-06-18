import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { calculateBossDamage } from "~/lib/boss/damage";
import { getExperimentGroup } from "~/lib/ml/quiz-recommender";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
  if (!quiz || quiz.userId !== user.userId) return error("NOT_FOUND", "Quiz not found", 404);

  const body = await request.json();
  const { answers } = body;
  if (!answers || !Array.isArray(answers)) return error("VALIDATION_ERROR", "answers array required", 400);

  const questions = quiz.questions as Array<{ correctIndex: number; difficulty: string }>;
  let correctCount = 0;
  const gradedAnswers = answers.map((a: any) => {
    const q = questions[a.questionIndex];
    const correct = q && a.selectedIndex === q.correctIndex;
    if (correct) correctCount++;
    return { questionIndex: a.questionIndex, selectedIndex: a.selectedIndex, correct };
  });

  const score = Math.round((correctCount / questions.length) * 100);

  const { processAction } = await import("~/lib/gamification/engine");
  processAction({
    userId: user.userId,
    actionType: "create_note",
    metadata: { source: "quiz", score, quizId: quiz.id },
  }).catch(() => {});

  const experimentGroup = getExperimentGroup(user.userId);

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: user.userId, score, answers: gradedAnswers as any },
  });

  const attempts = await prisma.quizAttempt.findMany({ where: { quizId: quiz.id }, select: { score: true } });
  const avgScore = attempts.reduce((s, a) => s + a.score, 0) / attempts.length;
  await prisma.quiz.update({
    where: { id: quiz.id },
    data: { lastReviewedAt: new Date(), reviewCount: { increment: 1 }, avgScore },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      actionType: "quiz_attempt",
      xpChange: 0,
      coinChange: 0,
      metadata: {
        quizId: quiz.id,
        score,
        reviewCount: quiz.reviewCount + 1,
        experimentGroup,
      },
    },
  });

  const accuracy = correctCount / questions.length;
  if (true) { // Always check for active boss in transaction
    const damage = calculateBossDamage({ actionType: "quiz", quizAccuracy: accuracy, quizStreak: quiz.reviewCount });
    try {
      await prisma.$transaction(async (tx) => {
        const boss = await tx.challenge.findFirst({
          where: { userId: user.userId, bossType: { in: ["daily", "weekly"] }, status: "active" },
        });
        if (!boss) return;
        await tx.$executeRaw`UPDATE "Challenge" SET "bossCurrentHp" = GREATEST(0, "bossCurrentHp" - ${damage}) WHERE id = ${boss.id}::uuid`;
        const updated = await tx.challenge.findUnique({ where: { id: boss.id }, select: { bossCurrentHp: true } });
        if (updated && (updated.bossCurrentHp ?? 0) <= 0) {
          await tx.challenge.update({ where: { id: boss.id }, data: { status: "completed", completedAt: new Date() } });
        }
        await tx.auditLog.create({
          data: {
            userId: user.userId,
            actionType: "boss_damage",
            xpChange: 0,
            coinChange: 0,
            metadata: { bossId: boss.id, damage, source: "quiz", isDead: (updated?.bossCurrentHp ?? 0) <= 0, bossName: boss.bossName },
          },
        });
      });
    } catch (e) { console.error("[boss] auto-damage failed:", e); }
  }

  return success({ attempt, score, avgScore, experimentGroup });
}
