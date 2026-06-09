import type { Prisma } from "@prisma/client";

export async function checkQuestProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  actionType: string,
  metadata?: Record<string, unknown>
): Promise<{ questId: string; progress: number; target: number; completed: boolean }[]> {
  const userQuests = await tx.userQuest.findMany({
    where: { userId, status: "active" },
    include: { quest: true },
  });

  if (userQuests.length === 0) return [];

  const increment =
    typeof metadata?.wordCount === "number"
      ? metadata.wordCount
      : typeof metadata?.questProgress === "number"
        ? metadata.questProgress
        : 1;

  const results: { questId: string; progress: number; target: number; completed: boolean }[] = [];

  for (const uq of userQuests) {
    const criteria = uq.quest.criteria as Record<string, unknown>;
    if (criteria.action !== actionType) continue;

    const current =
      typeof (uq.progress as Record<string, unknown>)?.current === "number"
        ? ((uq.progress as Record<string, unknown>).current as number)
        : 0;
    const target = typeof criteria.count === "number" ? criteria.count : 1;
    const newProgress = current + increment;
    const completed = newProgress >= target;

    await tx.userQuest.update({
      where: { id: uq.id },
      data: {
        progress: { current: newProgress },
        ...(completed
          ? { status: "completed", completedAt: new Date() }
          : {}),
      },
    });

    results.push({
      questId: uq.questId,
      progress: newProgress,
      target,
      completed,
    });
  }

  return results;
}
