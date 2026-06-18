import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { predictDifficulty } from "~/lib/ml/quiz-recommender";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const quizIds = body.quizIds as string[];
  if (!quizIds || !Array.isArray(quizIds)) return error("VALIDATION_ERROR", "quizIds array required", 400);
  if (quizIds.length > 20) return error("VALIDATION_ERROR", "Maximum 20 quizzes per batch", 400);

  const results: Record<string, number> = {};
  for (const quizId of quizIds) {
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { userId: true } });
    if (quiz && quiz.userId === user.userId) {
      results[quizId] = await predictDifficulty(user.userId, quizId);
    }
  }

  return success(results);
}
