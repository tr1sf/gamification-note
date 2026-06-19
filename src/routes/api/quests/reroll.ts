import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const questId = body.questId as string;
  const inventoryId = body.inventoryId as string;

  const userQuest = await prisma.userQuest.findUnique({
    where: { userId_questId: { userId: user.userId, questId } },
    include: { quest: { select: { questType: true } } },
  });
  if (!userQuest) return error("NOT_FOUND", "Quest not found", 404);

  const reroll = await prisma.userInventory.findUnique({
    where: { id: inventoryId },
    include: { item: true },
  });
  if (!reroll || reroll.userId !== user.userId) return error("NOT_FOUND", "Reroll not found", 404);
  const usageType = (reroll.item.category as Record<string, unknown> | null)?.usageType;
  if (usageType !== "quest_reroll") return error("INVALID", "Not a quest reroll", 400);

  const candidates = await prisma.quest.findMany({
    where: {
      questType: userQuest.quest.questType,
      isActive: true,
      id: { not: questId },
    },
  });

  if (candidates.length === 0) return error("NO_ALTERNATIVES", "No other quests available", 400);

  const newQuest = candidates[Math.floor(Math.random() * candidates.length)];

  await prisma.$transaction(async (tx) => {
    await tx.userQuest.delete({ where: { id: userQuest.id } });
    if ((reroll.quantity ?? 1) > 1) {
      await tx.userInventory.update({
        where: { id: inventoryId },
        data: { quantity: { decrement: 1 } },
      });
    } else {
      await tx.userInventory.delete({ where: { id: inventoryId } });
    }
    await tx.userQuest.create({
      data: {
        userId: user.userId,
        questId: newQuest.id,
        progress: { current: 0 },
        status: "active",
      },
    });
  });

  return success({ newQuestId: newQuest.id, newQuestTitle: newQuest.title });
}
