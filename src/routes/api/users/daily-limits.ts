import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { getDailyCaps } from "~/lib/gamification/engine";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const userData = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      level: true,
      streak: true,
      dailyXpEarned: true,
      dailyCoinsEarned: true,
      lastRewardResetDate: true,
    },
  });
  if (!userData) return error("NOT_FOUND", "User not found", 404);

  const lastReset = userData.lastRewardResetDate;
  const isNewDay = !lastReset || (() => {
    const today = new Date();
    const last = new Date(lastReset);
    return (
      today.getUTCFullYear() !== last.getUTCFullYear() ||
      today.getUTCMonth() !== last.getUTCMonth() ||
      today.getUTCDate() !== last.getUTCDate()
    );
  })();

  const xpEarned = isNewDay ? 0 : userData.dailyXpEarned;
  const coinsEarned = isNewDay ? 0 : userData.dailyCoinsEarned;

  const caps = getDailyCaps(userData.level, userData.streak);

  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);

  return success({
    dailyXpCap: caps.baseXp,
    dailyCoinCap: caps.baseCoin,
    streakBonus: caps.streakMultiplier,
    effectiveXpCap: caps.effectiveXp,
    effectiveCoinCap: caps.effectiveCoin,
    xpEarned,
    coinsEarned,
    xpRemaining: Math.max(0, caps.effectiveXp - xpEarned),
    coinsRemaining: Math.max(0, caps.effectiveCoin - coinsEarned),
    resetAt: resetAt.toISOString(),
  });
}