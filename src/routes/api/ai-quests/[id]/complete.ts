import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { processAction } from "~/lib/gamification/engine";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const quest = await prisma.aIQuest.findUnique({ where: { id: params.id } });
  if (!quest || quest.userId !== user.userId) return error("NOT_FOUND", "Quest not found", 404);
  if (quest.status !== "active") return error("INVALID_STATE", "Quest not active", 400);

  // Verify the user actually performed the required action since the quest was created
  const matchingActions = await prisma.auditLog.count({
    where: {
      userId: user.userId,
      actionType: quest.actionType,
      createdAt: { gte: quest.createdAt },
    },
  });

  if (matchingActions < quest.target) {
    return error("NOT_COMPLETED", `You need to perform this action ${quest.target} time(s) to complete this quest`, 400);
  }

  await prisma.aIQuest.update({
    where: { id: params.id },
    data: { status: "completed", completedAt: new Date(), rewarded: true },
  });

  const gamification = await processAction({
    userId: user.userId,
    actionType: "complete_quest",
    metadata: { xpReward: quest.xpReward, coinReward: quest.coinReward, questTitle: quest.title },
  });

  return success({ quest, gamification });
}