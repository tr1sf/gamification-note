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

  // Count-based quests (create_note, daily_login, make_public, …) advance by 1
  // per matching action. Only word-count quests accumulate the action's
  // wordCount — otherwise a single 500-word note would instantly complete a
  // "create 10 notes" quest because the action carries wordCount in metadata.
  const increment =
    actionType === "write_words"
      ? (typeof metadata?.wordCount === "number" ? metadata.wordCount : 0)
      : (typeof metadata?.questProgress === "number" ? metadata.questProgress : 1);

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
