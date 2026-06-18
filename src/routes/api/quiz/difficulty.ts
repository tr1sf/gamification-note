import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { predictDifficulty } from "~/lib/ml/quiz-recommender";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const quizId = body.quizId as string;
  if (!quizId) return error("VALIDATION_ERROR", "quizId required", 400);

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { userId: true } });
  if (!quiz || quiz.userId !== user.userId) return error("NOT_FOUND", "Quiz not found", 404);

  const difficulty = await predictDifficulty(user.userId, quizId);
  return success({ quizId, difficulty });
}
