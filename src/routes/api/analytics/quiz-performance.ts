import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: user.userId },
    orderBy: { completedAt: "asc" },
    include: { quiz: { select: { reviewCount: true } } },
  });

  const byStage = new Map<number, number[]>();
  for (const a of attempts) {
    const stage = a.quiz.reviewCount;
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage)!.push(a.score);
  }

  const accuracyByStage: number[] = [0, 0, 0, 0];
  for (const [stage, scores] of byStage) {
    if (stage < 4) accuracyByStage[stage] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  const improvement = accuracyByStage.filter(s => s > 0).length >= 2
    ? accuracyByStage[3] - accuracyByStage[0]
    : 0;

  const total = await prisma.quiz.count({ where: { userId: user.userId } });
  const avgAccuracy = attempts.length > 0
    ? Math.round(attempts.reduce((a, b) => a + b.score, 0) / attempts.length)
    : 0;

  return success({
    totalQuizzes: total,
    totalAttempts: attempts.length,
    avgAccuracy,
    accuracyByStage,
    improvement,
  });
}
