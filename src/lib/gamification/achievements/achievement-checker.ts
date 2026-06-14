import type { Prisma } from "@prisma/client";

const ACHIEVEMENT_REWARDS: Record<string, string> = {
  "First Scroll": "beginner_badge",
  "Streak Master": "streak_freeze",
  "Wordsmith": "effect_sparkle",
  "Quest Champion": "gold_confetti",
  "Guild Leader": "guild_master_nameplate",
};

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

  if (unlocked.length > 0) {
    const rewardNames = unlocked
      .map((a) => ACHIEVEMENT_REWARDS[a.title])
      .filter(Boolean);

    if (rewardNames.length > 0) {
      const items = await tx.cosmeticItem.findMany({
        where: { name: { in: rewardNames } },
      });

      for (const achTitle of unlocked.map((a) => a.title)) {
        const rewardType = ACHIEVEMENT_REWARDS[achTitle];
        if (!rewardType) continue;
        const item = items.find((i) => i.type === rewardType || i.name === rewardType);
        if (item) {
          await tx.userInventory.upsert({
            where: { userId_cosmeticItemId: { userId, cosmeticItemId: item.id } },
            create: { userId, cosmeticItemId: item.id },
            update: {},
          });
        }
      }
    }
  }

  return unlocked;
}
