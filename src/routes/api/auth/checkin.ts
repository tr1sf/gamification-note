import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { grantReward } from "~/lib/gamification/engine";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const alreadyClaimed = await prisma.auditLog.findFirst({
    where: { userId: user.userId, actionType: "daily_checkin", createdAt: { gte: today } },
  });

  const userData = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { streak: true },
  });

  return success({
    claimed: !!alreadyClaimed,
    xpGained: alreadyClaimed?.xpChange ?? 0,
    coinsGained: alreadyClaimed?.coinChange ?? 0,
    streak: userData?.streak ?? 0,
  });
}

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  // Atomic: check + create in a single transaction to prevent double-claim
  const result = await prisma.$transaction(async (tx) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const alreadyClaimed = await tx.auditLog.findFirst({
      where: {
        userId: user.userId,
        actionType: "daily_checkin",
        createdAt: { gte: today },
      },
    });

    if (alreadyClaimed) {
      return { alreadyClaimed: true as const };
    }

    // Base reward + streak bonus
    const userData = await tx.user.findUnique({
      where: { id: user.userId },
      select: { streak: true, lastRewardResetDate: true },
    });

    const oldStreak = userData?.streak ?? 0;
    const lastReset = userData?.lastRewardResetDate;

    // Calculate new streak
    let newStreak = oldStreak;
    if (!lastReset) {
      newStreak = 1;
    } else {
      const lastDate = new Date(lastReset);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      lastDate.setUTCHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
      if (diffDays === 1) {
        newStreak = oldStreak + 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
    }

    const baseXp = 10;
    const baseCoins = 5;
    const streakBonus = Math.min(newStreak, 30);

    // Grant reward inside the transaction
    const reward = await grantReward({
      userId: user.userId,
      xp: baseXp + streakBonus,
      coins: baseCoins,
      actionType: "daily_checkin",
      metadata: { streak: newStreak, bonus: streakBonus },
    });

    await tx.user.update({
      where: { id: user.userId },
      data: { streak: newStreak },
    });

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        actionType: "daily_checkin",
        xpChange: reward.xpGained,
        coinChange: reward.coinsGained,
        metadata: { claimed: true, streak: newStreak },
      },
    });

    return {
      alreadyClaimed: false as const,
      xpGained: reward.xpGained,
      coinsGained: reward.coinsGained,
      streak: newStreak,
      streakBonus,
      leveledUp: reward.leveledUp,
      newLevel: reward.newLevel,
      newTitle: reward.newTitle,
    };
  });

  if (result.alreadyClaimed) {
    return error("ALREADY_CLAIMED", "You already claimed your daily reward today", 409);
  }

  return success({
    xpGained: result.xpGained,
    coinsGained: result.coinsGained,
    streak: result.streak,
    streakBonus: result.streakBonus,
    leveledUp: result.leveledUp,
    newLevel: result.newLevel,
    newTitle: result.newTitle,
  });
}
