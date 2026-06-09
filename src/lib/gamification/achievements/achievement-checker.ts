import type { Prisma } from "@prisma/client";

export async function checkAchievements(
  tx: Prisma.TransactionClient,
  userId: string,
  actionType: string,
  metadata?: Record<string, unknown>
): Promise<{ id: string; title: string }[]> {
  const allAchievements = await tx.achievement.findMany();

  const relevant = allAchievements.filter((a) => {
    const criteria = a.criteria as Record<string, unknown>;
    return criteria.action === actionType;
  });

  if (relevant.length === 0) return [];

  const unlocked: { id: string; title: string }[] = [];

  for (const achievement of relevant) {
    const criteria = achievement.criteria as Record<string, unknown>;
    const target = typeof criteria.count === "number" ? criteria.count : 1;

    const existing = await tx.userAchievement.findUnique({
      where: {
        userId_achievementId: { userId, achievementId: achievement.id },
      },
    });

    if (existing && existing.unlockedAt) continue;

    const currentProgress = existing
      ? (typeof (existing.progress as Record<string, unknown>).current === "number"
          ? ((existing.progress as Record<string, unknown>).current as number)
          : 0)
      : 0;

    const increment =
      typeof metadata?.wordCount === "number"
        ? metadata.wordCount
        : typeof metadata?.achievementProgress === "number"
          ? metadata.achievementProgress
          : 1;

    const newProgress = currentProgress + increment;
    const newlyUnlocked = newProgress >= target;

    if (existing) {
      await tx.userAchievement.update({
        where: { id: existing.id },
        data: {
          progress: { current: newProgress },
          ...(newlyUnlocked ? { unlockedAt: new Date() } : {}),
        },
      });
    } else {
      await tx.userAchievement.create({
        data: {
          userId,
          achievementId: achievement.id,
          progress: { current: newProgress },
          ...(newlyUnlocked ? { unlockedAt: new Date() } : {}),
        },
      });
    }

    if (newlyUnlocked) {
      unlocked.push({ id: achievement.id, title: achievement.title });
    }
  }

  return unlocked;
}
