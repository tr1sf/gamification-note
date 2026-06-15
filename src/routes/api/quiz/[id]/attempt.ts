import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

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

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: user.userId, score, answers: gradedAnswers as any },
  });

  const attempts = await prisma.quizAttempt.findMany({ where: { quizId: quiz.id }, select: { score: true } });
  const avgScore = attempts.reduce((s, a) => s + a.score, 0) / attempts.length;
  await prisma.quiz.update({
    where: { id: quiz.id },
    data: { lastReviewedAt: new Date(), reviewCount: { increment: 1 }, avgScore },
  });

  const accuracy = correctCount / questions.length;
  const activeBoss = await prisma.challenge.findFirst({
    where: { userId: user.userId, bossType: { in: ["daily", "weekly"] }, status: "active" },
  });
  if (activeBoss) {
    const damage = Math.round(10 * (1 + accuracy) * (1 + quiz.reviewCount * 0.2));
    await prisma.$executeRaw`UPDATE "Challenge" SET "bossCurrentHp" = GREATEST(0, "bossCurrentHp" - ${damage}) WHERE id = ${activeBoss.id}`;
    const updated = await prisma.challenge.findUnique({ where: { id: activeBoss.id }, select: { bossCurrentHp: true } });
    if (updated && (updated.bossCurrentHp ?? 0) <= 0) {
      await prisma.challenge.update({ where: { id: activeBoss.id }, data: { status: "completed", completedAt: new Date() } });
    }
  }

  return success({ attempt, score, avgScore });
}
