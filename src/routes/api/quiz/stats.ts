import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const [totalQuizzes, totalAttempts, scoreAgg] = await Promise.all([
    prisma.quiz.count({ where: { userId: user.userId } }),
    prisma.quizAttempt.count({ where: { userId: user.userId } }),
    prisma.quiz.aggregate({ where: { userId: user.userId, reviewCount: { gte: 0 } }, _avg: { avgScore: true } }),
  ]);

  const accuracyByStage: number[] = [];
  for (let stage = 0; stage < 4; stage++) {
    const quizzes = await prisma.quiz.findMany({
      where: { userId: user.userId, reviewCount: { gte: stage + 1 } },
      select: { id: true },
    });
    if (quizzes.length === 0) { accuracyByStage.push(0); continue; }
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId: { in: quizzes.map(q => q.id) } },
      orderBy: { completedAt: "asc" },
      select: { score: true, quizId: true },
    });
    const stageScores = new Map<string, number[]>();
    for (const a of attempts) {
      if (!stageScores.has(a.quizId)) stageScores.set(a.quizId, []);
      stageScores.get(a.quizId)!.push(a.score);
    }
    const stageAvg = Array.from(stageScores.values())
      .map(scores => scores[Math.min(stage, scores.length - 1)] || 0)
      .reduce((a,b) => a+b, 0) / (quizzes.length || 1);
    accuracyByStage.push(Math.round(stageAvg));
  }

  return success({
    totalQuizzes,
    totalAttempts,
    avgScore: scoreAgg._avg.avgScore || 0,
    accuracyByStage,
    improvement: accuracyByStage.length >= 2 ? accuracyByStage[accuracyByStage.length - 1] - accuracyByStage[0] : 0,
  });
}
