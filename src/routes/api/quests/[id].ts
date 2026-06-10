import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const quest = await prisma.quest.findUnique({
    where: { id: params.id },
  });

  if (!quest || !quest.isActive) {
    return error("NOT_FOUND", "Quest not found", 404);
  }

  const userQuest = await prisma.userQuest.findUnique({
    where: { userId_questId: { userId: user.userId, questId: params.id } },
  });

  return success({
    ...quest,
    userProgress: userQuest
      ? {
          status: userQuest.status,
          progress: userQuest.progress,
          completedAt: userQuest.completedAt,
          userQuestId: userQuest.id,
        }
      : null,
  });
}
