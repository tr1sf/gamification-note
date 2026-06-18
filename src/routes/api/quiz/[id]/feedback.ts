import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const quiz = await prisma.quiz.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!quiz || quiz.userId !== user.userId) return error("NOT_FOUND", "Quiz not found", 404);

  const body = await request.json();
  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      actionType: "quiz_feedback",
      xpChange: 0,
      coinChange: 0,
      metadata: { quizId: params.id, rating: body.rating },
    },
  });

  return success({ recorded: true });
}
