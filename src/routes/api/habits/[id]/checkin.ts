import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { grantReward } from "~/lib/gamification/engine";
import { track } from "~/lib/analytics/tracker";
import { applyBossAbility } from "~/lib/boss/abilities";

function toUtcDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

// POST — check in a habit for today. Idempotent per day (unique [habitId, date]).
// Updates the streak and grants the habit's XP/coin reward on the first check-in.
export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const habit = await prisma.habit.findUnique({ where: { id: params.id } });
  if (!habit || habit.userId !== user.userId) {
    return error("NOT_FOUND", "Habit not found", 404);
  }

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const yest = new Date(now);
  yest.setUTCDate(yest.getUTCDate() - 1);
  const yestKey = yest.toISOString().slice(0, 10);
  const lastKey = habit.lastCompletedOn ? habit.lastCompletedOn.toISOString().slice(0, 10) : null;

  if (lastKey === todayKey) {
    return error("CONFLICT", "Already checked in today", 409);
  }

  const newStreak = lastKey === yestKey ? habit.streak + 1 : 1;
  const bestStreak = Math.max(habit.bestStreak, newStreak);

  try {
    await prisma.$transaction([
      prisma.habitCheckin.create({
        data: { habitId: habit.id, userId: user.userId, date: toUtcDate(todayKey) },
      }),
      prisma.habit.update({
        where: { id: habit.id },
        data: { streak: newStreak, bestStreak, lastCompletedOn: toUtcDate(todayKey) },
      }),
    ]);
  } catch (e: any) {
    // Unique [habitId, date] violation — a concurrent check-in already landed.
    if (e?.code === "P2002") return error("CONFLICT", "Already checked in today", 409);
    throw e;
  }

  const reward = await grantReward({
    userId: user.userId,
    xp: habit.xpReward,
    coins: habit.coinReward,
    actionType: "habit_checkin",
    metadata: { habitId: habit.id, streak: newStreak },
  });

  track({
    userId: user.userId,
    actionType: "habit_checkin",
    metadata: { habitId: habit.id, habitTitle: habit.title, streakBefore: habit.streak, streakAfter: newStreak, maxStreak: bestStreak },
  });

  const activeBosses = await prisma.challenge.findMany({
    where: { userId: user.userId, bossType: { in: ["daily", "weekly"] }, status: "active" },
  });
  for (const boss of activeBosses) {
    const ability = boss.bossAbility as any;
    const baseDmg = 3 + newStreak;
    const result = applyBossAbility(ability, {
      actionType: "habit",
      damage: baseDmg,
      bossCurrentHp: boss.bossCurrentHp ?? 0,
      bossMaxHp: boss.bossMaxHp ?? 100,
    });
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE "Challenge" SET "bossCurrentHp" = GREATEST(0, "bossCurrentHp" - ${result.damage}) WHERE id = ${boss.id}::uuid`;
        const updated = await tx.challenge.findUnique({ where: { id: boss.id }, select: { bossCurrentHp: true } });
        if (updated && (updated.bossCurrentHp ?? 0) <= 0) {
          await tx.challenge.update({ where: { id: boss.id }, data: { status: "completed", completedAt: new Date() } });
        }
        await tx.auditLog.create({
          data: {
            userId: user.userId,
            actionType: "boss_damage",
            xpChange: 0,
            coinChange: 0,
            metadata: { bossId: boss.id, damage: result.damage, source: "habit", bossName: boss.bossName, abilityMsg: result.message },
          },
        });
      });
    } catch (e) { console.error("[boss] auto-damage failed:", e); }
  }

  return success({
    currentStreak: newStreak,
    bestStreak,
    completedToday: true,
    xpGained: reward.xpGained,
    coinsGained: reward.coinsGained,
    leveledUp: reward.leveledUp,
    newLevel: reward.newLevel,
    newTitle: reward.newTitle,
  });
}
