import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";
import { processAction } from "~/lib/gamification/engine";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = (request as any).locals?.user;
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const userQuest = await prisma.userQuest.findUnique({
    where: { userId_questId: { userId: user.userId, questId: params.id } },
    include: { quest: true },
  });

  if (!userQuest) {
    return error("NOT_FOUND", "Quest progress not found", 404);
  }

  if (userQuest.status === "claimed") {
    return success({ claimed: true, gamification: null });
  }

  if (userQuest.status !== "completed") {
    return error("NOT_COMPLETED", "Quest is not yet completed", 400);
  }

  await prisma.userQuest.update({
    where: { id: userQuest.id },
    data: { status: "claimed" },
  });

  const gamification = await processAction({
    userId: user.userId,
    actionType: "complete_quest",
    metadata: {
      xpReward: userQuest.quest.xpReward,
      coinReward: userQuest.quest.coinReward,
    },
  });

  return success({ claimed: true, gamification });
}
