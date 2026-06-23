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

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const alreadyClaimed = await prisma.auditLog.findFirst({
    where: {
      userId: user.userId,
      actionType: "daily_checkin",
      createdAt: { gte: today },
    },
  });

  if (alreadyClaimed) {
    return error("ALREADY_CLAIMED", "You already claimed your daily reward today", 409);
  }

  // Base reward + streak bonus
  const userData = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { streak: true },
  });

  const streak = userData?.streak ?? 0;
  const baseXp = 10;
  const baseCoins = 5;
  const streakBonus = Math.min(streak, 30); // +1 XP per streak day, max 30

  const result = await grantReward({
    userId: user.userId,
    xp: baseXp + streakBonus,
    coins: baseCoins,
    actionType: "daily_checkin",
    metadata: { streak, bonus: streakBonus },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      actionType: "daily_checkin",
      xpChange: result.xpGained,
      coinChange: result.coinsGained,
      metadata: { claimed: true, streak },
    },
  });

  return success({
    xpGained: result.xpGained,
    coinsGained: result.coinsGained,
    streak,
    streakBonus,
    leveledUp: result.leveledUp,
    newLevel: result.newLevel,
    newTitle: result.newTitle,
  });
}
