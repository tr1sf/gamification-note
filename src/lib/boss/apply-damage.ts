import { parseBossAbility, applyBossAbility, type BossAbility } from "./abilities";

type TxClient = Parameters<Parameters<import("@prisma/client").PrismaClient["$transaction"]>[0]>[0];

/**
 * Apply boss damage from any action (note, quiz, habit, focus) to ALL active bosses.
 * Shared logic used by notes/index.ts, habits/checkin.ts, quiz/attempt.ts, and boss/attack.ts.
 *
 * IMPORTANT: fog_shield and colossal track per-boss, not globally.
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

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // Check if user completed any quests today (for procrastination_aura ability)
  const questsCompletedToday = await tx.userQuest.count({
    where: { userId, completedAt: { gte: todayStart } },
  });

  for (const boss of activeBosses) {
    const ability = parseBossAbility(boss.bossAbility);

    // Per-boss attack tracking: fog_shield and colossal only count attacks on THIS boss
    let attacksToday = 0;
    let usedTypesToday = new Set<string>();

    if (ability && (ability.type === "fog_shield" || ability.type === "colossal")) {
      const bossLogs = await tx.auditLog.findMany({
        where: {
          userId,
          actionType: "boss_damage",
          createdAt: { gte: todayStart },
          metadata: { path: ["bossId"], equals: boss.id },
        },
        select: { metadata: true },
      });
      attacksToday = bossLogs.length;
      usedTypesToday = new Set<string>();
      for (const log of bossLogs) {
        const src = (log.metadata as any)?.source;
        if (typeof src === "string") usedTypesToday.add(src);
      }
    }

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
      // Atomic: update HP and check completion in one step to avoid TOCTOU
      const updated = await tx.$queryRaw<Array<{ bossCurrentHp: number }>>`
        UPDATE "Challenge"
        SET "bossCurrentHp" = GREATEST(0, "bossCurrentHp" - ${dmg})
        WHERE id = ${boss.id}::uuid AND "status" = 'active'
        RETURNING "bossCurrentHp"
      `;

      if (updated.length > 0 && updated[0].bossCurrentHp <= 0) {
        await tx.challenge.update({
          where: { id: boss.id },
          data: { status: "completed", completedAt: new Date() },
        });
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
