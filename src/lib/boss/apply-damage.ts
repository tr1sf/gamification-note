import { parseBossAbility, applyBossAbility, type BossAbility } from "./abilities";

type TxClient = Parameters<Parameters<import("@prisma/client").PrismaClient["$transaction"]>[0]>[0];

/**
 * Apply boss damage from any action (note, quiz, habit, focus) to ALL active bosses.
 * Shared logic used by notes/index.ts, habits/checkin.ts, quiz/attempt.ts, and boss/attack.ts.
 */
export async function applyBossDamageToAll(
  tx: TxClient,
  userId: string,
  actionType: "note" | "quiz" | "habit" | "focus",
  baseDamage: number,
  metadata: Record<string, unknown>
): Promise<void> {
  const activeBosses = await tx.challenge.findMany({
    where: { userId, bossType: { in: ["daily", "weekly"] }, status: "active" },
  });

  if (activeBosses.length === 0) return;

  // Count all boss attacks today (for fog_shield ability)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const attacksToday = await tx.auditLog.count({
    where: { userId, actionType: "boss_damage", createdAt: { gte: todayStart } },
  });

  // Check if user completed any quests today (for procrastination_aura ability)
  const questsCompletedToday = await tx.userQuest.count({
    where: { userId, completedAt: { gte: todayStart } },
  });

  // Collect which action types were used today (for colossal ability)
  const todayLogs = await tx.auditLog.findMany({
    where: { userId, actionType: "boss_damage", createdAt: { gte: todayStart } },
    select: { metadata: true },
  });
  const usedTypesToday = new Set<string>();
  for (const log of todayLogs) {
    const src = (log.metadata as any)?.source;
    if (typeof src === "string") usedTypesToday.add(src);
  }

  for (const boss of activeBosses) {
    const ability = parseBossAbility(boss.bossAbility);
    const result = applyBossAbility(ability, {
      actionType,
      damage: baseDamage,
      bossCurrentHp: boss.bossCurrentHp ?? 0,
      bossMaxHp: boss.bossMaxHp ?? 100,
      attacksToday,
      usedTypesToday,
      questCompletedToday: questsCompletedToday > 0,
    });
    const dmg = result.damage;

    try {
      await tx.$executeRaw`UPDATE "Challenge" SET "bossCurrentHp" = GREATEST(0, "bossCurrentHp" - ${dmg}) WHERE id = ${boss.id}::uuid AND "status" = 'active'`;
      const updated = await tx.challenge.findUnique({ where: { id: boss.id }, select: { bossCurrentHp: true } });
      if (updated && (updated.bossCurrentHp ?? 0) <= 0) {
        await tx.challenge.update({ where: { id: boss.id }, data: { status: "completed", completedAt: new Date() } });
      }
      await tx.auditLog.create({
        data: {
          userId,
          actionType: "boss_damage",
          xpChange: 0,
          coinChange: 0,
          metadata: { bossId: boss.id, damage: dmg, source: actionType, bossName: boss.bossName, abilityMsg: result.message, ...metadata },
        },
      });
    } catch (e) {
      console.error("[boss] auto-damage failed:", e);
    }
  }
}
