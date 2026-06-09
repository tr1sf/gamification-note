import type { Prisma } from "@prisma/client";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(): Date {
  const d = startOfWeek();
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function rotateQuestType(
  tx: Prisma.TransactionClient,
  userId: string,
  questType: "daily" | "weekly",
  startOfPeriod: Date,
  endOfPeriod: Date
): Promise<void> {
  const existing = await tx.userQuest.findFirst({
    where: {
      userId,
      quest: { questType },
      createdAt: { gte: startOfPeriod, lte: endOfPeriod },
    },
    include: { quest: true },
  });

  if (existing) return;

  await tx.userQuest.updateMany({
    where: {
      userId,
      quest: { questType },
      status: "active",
    },
    data: { status: "expired" },
  });

  const availableQuests = await tx.quest.findMany({
    where: { questType, isActive: true },
  });

  const shuffled = availableQuests.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);

  for (const quest of selected) {
    await tx.userQuest.create({
      data: {
        userId,
        questId: quest.id,
        progress: { current: 0 },
        status: "active",
      },
    });
  }
}

export async function rotateQuestsIfNeeded(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  await rotateQuestType(tx, userId, "daily", startOfToday(), endOfToday());
  await rotateQuestType(tx, userId, "weekly", startOfWeek(), endOfWeek());
}
