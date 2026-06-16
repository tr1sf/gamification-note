import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { grantReward } from "~/lib/gamification/engine";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const minutes = Math.min(Math.max(body.minutes || 25, 5), 120);

  const xp = Math.floor(minutes / 5) * 2;
  const coins = minutes >= 25 ? 3 : 1;

  const reward = await grantReward({
    userId: user.userId,
    xp,
    coins,
    actionType: "focus_sprint",
    metadata: { minutes },
  });

  const today = new Date().toISOString().slice(0, 10);
  const todaySprints = await prisma.auditLog.count({
    where: { userId: user.userId, actionType: "focus_sprint", createdAt: { gte: new Date(today) } },
  });
  const streakMultiplier = todaySprints >= 3 ? 2 : 1;

  return success({
    xp: xp * streakMultiplier,
    coins: reward.coinsGained,
    minutes,
    sprintStreak: todaySprints,
    streakMultiplier,
  });
}
