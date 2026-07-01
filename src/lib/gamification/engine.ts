import type { Prisma } from "@prisma/client";
import { prisma as db } from "~/lib/db";
import { calculateXP } from "./calculators/xp-calculator";
import { calculateCoins } from "./calculators/coin-calculator";
import { calculateLevel, getLevelTitle } from "./calculators/level-calculator";
import { checkQuestProgress } from "./quests/quest-checker";
import { rotateQuestsIfNeeded } from "./quests/quest-rotation";
import { checkAchievements } from "./achievements/achievement-checker";
import { createNotification } from "~/lib/socket/notifications";
import type { AuditMetadata } from "~/lib/analytics/types";
import { getActionMessage } from "./messages";
import {
  XP_WRITE_WORDS_PER_100,
  XP_WRITE_WORDS_MAX,
  DAILY_XP_BASE_CAP,
  DAILY_XP_PER_LEVEL,
  DAILY_COIN_BASE_CAP,
  DAILY_COIN_PER_LEVEL,
  STREAK_BONUS_PER_DAY,
  STREAK_BONUS_MAX,
} from "./constants";

async function checkActiveBooster(
  tx: Prisma.TransactionClient,
  userId: string,
  usageType: string,
): Promise<boolean> {
  const boosters = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT ui.id FROM "UserInventory" ui
    JOIN "CosmeticItem" ci ON ui."cosmeticItemId" = ci.id
    WHERE ui."userId" = ${userId}::uuid
      AND (ci.category->>'usageType' = ${usageType})
      AND ci.type = 'consumable'
      AND (ui."expiresAt" IS NULL OR ui."expiresAt" > NOW())
    LIMIT 1
  `;
  return boosters.length > 0;
}

export function getDailyCaps(level: number, streak: number) {
  const baseXp = DAILY_XP_BASE_CAP + (level - 1) * DAILY_XP_PER_LEVEL;
  const baseCoin = DAILY_COIN_BASE_CAP + (level - 1) * DAILY_COIN_PER_LEVEL;
  const streakMultiplier = Math.min(streak * STREAK_BONUS_PER_DAY, STREAK_BONUS_MAX);
  return {
    baseXp,
    baseCoin,
    streakMultiplier,
    effectiveXp: Math.round(baseXp * (1 + streakMultiplier)),
    effectiveCoin: Math.round(baseCoin * (1 + streakMultiplier)),
  };
}

function isNewDay(lastReset: Date | null): boolean {
  if (!lastReset) return true;
  const today = new Date();
  const last = new Date(lastReset);
  return (
    today.getUTCFullYear() !== last.getUTCFullYear() ||
    today.getUTCMonth() !== last.getUTCMonth() ||
    today.getUTCDate() !== last.getUTCDate()
  );
}

export interface ActionContext {
  userId: string;
  actionType: "create_note" | "update_note" | "write_words" | "make_public" | "daily_login" | "complete_quest" | "join_guild" | "create_guild" | "ai_summarize" | "review_note" | "structured_note" | "export_note" | "share_note" | "add_link";
  metadata?: Record<string, unknown>;
  analyticsMeta?: AuditMetadata;
}

export interface ActionResult {
  message: string;
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel?: number;
  newTitle?: string;
  unlockedAchievements: { id: string; title: string }[];
  questProgress: { questId: string; progress: number; target: number; completed: boolean }[];
}

export async function processAction(ctx: ActionContext): Promise<ActionResult> {
  const result = await (db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Single atomic read with FOR UPDATE to prevent race conditions on daily caps
    const rows = await tx.$queryRaw<Array<{
      xp: number; coins: number; level: number;
      streak: number; dailyXpEarned: number; dailyCoinsEarned: number;
      lastRewardResetDate: Date | null; xpBoosterUntil: Date | null;
    }>>`
      SELECT xp, coins, level, streak, "dailyXpEarned", "dailyCoinsEarned", "lastRewardResetDate", "xpBoosterUntil"
      FROM "User" WHERE id = ${ctx.userId}::uuid FOR UPDATE
    `;
    const user = rows[0];
    const dailyData = user;
    const caps = getDailyCaps(user.level, dailyData.streak);

    // Check XP Catalyst booster: 2x daily XP cap for 24h
    const now = new Date();
    const hasXpCatalyst = dailyData.xpBoosterUntil && now < dailyData.xpBoosterUntil;
    const effectiveXpCap = hasXpCatalyst ? caps.effectiveXp * 2 : caps.effectiveXp;

    // Reset if new day
    if (isNewDay(dailyData.lastRewardResetDate)) {
      await tx.$executeRaw`
        UPDATE "User" SET "dailyXpEarned" = 0, "dailyCoinsEarned" = 0, "lastRewardResetDate" = NOW()
        WHERE id = ${ctx.userId}::uuid
      `;
      dailyData.dailyXpEarned = 0;
      dailyData.dailyCoinsEarned = 0;
    }

    let xpGained = calculateXP(ctx.actionType, ctx.metadata, ctx.metadata?.dailyNoteCount as number | undefined);

    // Focus Potion: double word-count bonus portion of XP
    const hasFocusPotion = await checkActiveBooster(tx, ctx.userId, "focus_potion");
    if (hasFocusPotion && (ctx.actionType === "create_note" || ctx.actionType === "write_words")) {
      const wordCount = typeof ctx.metadata?.wordCount === "number" ? ctx.metadata.wordCount : 0;
      const wordBonus = Math.min(Math.floor(wordCount / 100) * XP_WRITE_WORDS_PER_100, XP_WRITE_WORDS_MAX);
      xpGained += wordBonus;
    }

    // XP Booster: double all XP gained
    const hasXpBoost = await checkActiveBooster(tx, ctx.userId, "xp_boost");
    if (hasXpBoost) {
      xpGained *= 2;
    }

    const coinsGained = calculateCoins(ctx.actionType, ctx.metadata);

    // Enforce daily reward caps (uses effectiveXpCap which accounts for XP Catalyst)
    const xpAfterCap = Math.max(0, Math.min(xpGained, effectiveXpCap - dailyData.dailyXpEarned));
    const coinsAfterCap = Math.max(0, Math.min(coinsGained, caps.effectiveCoin - dailyData.dailyCoinsEarned));

    // Update daily counters
    await tx.$executeRaw`
      UPDATE "User" SET
        "dailyXpEarned" = "dailyXpEarned" + ${xpAfterCap},
        "dailyCoinsEarned" = "dailyCoinsEarned" + ${coinsAfterCap}
      WHERE id = ${ctx.userId}::uuid
    `;

    const newXp = user.xp + xpAfterCap;
    const newLevel = calculateLevel(newXp);
    const leveledUp = newLevel > user.level;

    await tx.user.update({
      where: { id: ctx.userId },
      data: {
        xp: { increment: xpAfterCap },
        coins: { increment: coinsAfterCap },
        ...(leveledUp ? { level: newLevel, title: getLevelTitle(newLevel) } : {}),
      },
    });

    const enrichedMeta: Record<string, unknown> = {
      ...(ctx.metadata ?? {}),
      ...(ctx.analyticsMeta ?? {}),
      levelBefore: user.level,
      levelAfter: leveledUp ? newLevel : user.level,
    };

    await tx.auditLog.create({
      data: {
        userId: ctx.userId,
        actionType: ctx.actionType,
        xpChange: xpAfterCap,
        coinChange: coinsAfterCap,
        metadata: enrichedMeta as Prisma.InputJsonValue,
      },
    });

    await rotateQuestsIfNeeded(tx, ctx.userId);

    const questProgress = await checkQuestProgress(tx, ctx.userId, ctx.actionType, ctx.metadata);

    const unlockedAchievements = await checkAchievements(tx, ctx.userId, ctx.actionType, ctx.metadata);

    return {
      message: getActionMessage(ctx.actionType, { xp: xpAfterCap, coins: coinsAfterCap, ...ctx.metadata }),
      xpGained: xpAfterCap,
      coinsGained: coinsAfterCap,
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined,
      newTitle: leveledUp ? getLevelTitle(newLevel) : undefined,
      unlockedAchievements,
      questProgress,
    };
  }) as Promise<ActionResult>);

  triggerNotifications(ctx.userId, result);
  return result;
}

// Grant an explicit XP/coin reward (e.g. habit check-in, approved guild task)
// where the amount is configured per-item rather than derived from an action
// type. Mirrors processAction's user update + level recalculation + audit log.
export async function grantReward(opts: {
  userId: string;
  xp: number;
  coins: number;
  actionType: string;
  metadata?: Record<string, unknown>;
}): Promise<ActionResult> {
  const xpGained = Math.max(0, Math.round(opts.xp || 0));
  const coinsGained = Math.max(0, Math.round(opts.coins || 0));

  const result = await (db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Single atomic read with FOR UPDATE — mirrors processAction
    const rows = await tx.$queryRaw<Array<{
      xp: number; level: number;
      streak: number; dailyXpEarned: number; dailyCoinsEarned: number;
      lastRewardResetDate: Date | null; xpBoosterUntil: Date | null;
    }>>`
      SELECT xp, level, streak, "dailyXpEarned", "dailyCoinsEarned", "lastRewardResetDate", "xpBoosterUntil"
      FROM "User" WHERE id = ${opts.userId}::uuid FOR UPDATE
    `;
    const user = rows[0];
    const dailyData = user;
    const caps = getDailyCaps(user.level, dailyData.streak);

    // Check XP Catalyst booster: 2x daily XP cap for 24h
    const now = new Date();
    const hasXpCatalyst = dailyData.xpBoosterUntil !== null && now < dailyData.xpBoosterUntil;
    const effectiveXpCap = hasXpCatalyst ? caps.effectiveXp * 2 : caps.effectiveXp;

    // Reset if new day
    if (isNewDay(dailyData.lastRewardResetDate)) {
      await tx.$executeRaw`
        UPDATE "User" SET "dailyXpEarned" = 0, "dailyCoinsEarned" = 0, "lastRewardResetDate" = NOW()
        WHERE id = ${opts.userId}::uuid
      `;
      dailyData.dailyXpEarned = 0;
      dailyData.dailyCoinsEarned = 0;
    }

    // Enforce daily reward caps (uses effectiveXpCap which accounts for XP Catalyst)
    const xpAfterCap = Math.max(0, Math.min(xpGained, effectiveXpCap - dailyData.dailyXpEarned));
    const coinsAfterCap = Math.max(0, Math.min(coinsGained, caps.effectiveCoin - dailyData.dailyCoinsEarned));

    // Update daily counters
    await tx.$executeRaw`
      UPDATE "User" SET
        "dailyXpEarned" = "dailyXpEarned" + ${xpAfterCap},
        "dailyCoinsEarned" = "dailyCoinsEarned" + ${coinsAfterCap}
      WHERE id = ${opts.userId}::uuid
    `;

    const newXp = user.xp + xpAfterCap;
    const newLevel = calculateLevel(newXp);
    const leveledUp = newLevel > user.level;

    await tx.user.update({
      where: { id: opts.userId },
      data: {
        xp: { increment: xpAfterCap },
        coins: { increment: coinsAfterCap },
        ...(leveledUp ? { level: newLevel, title: getLevelTitle(newLevel) } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: opts.userId,
        actionType: opts.actionType,
        xpChange: xpAfterCap,
        coinChange: coinsAfterCap,
        metadata: {
          ...(opts.metadata ?? {}),
          levelBefore: user.level,
          levelAfter: leveledUp ? newLevel : user.level,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      message: getActionMessage(opts.actionType, { xp: xpAfterCap, coins: coinsAfterCap, ...opts.metadata }),
      xpGained: xpAfterCap,
      coinsGained: coinsAfterCap,
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined,
      newTitle: leveledUp ? getLevelTitle(newLevel) : undefined,
      unlockedAchievements: [],
      questProgress: [],
    } as ActionResult;
  }) as Promise<ActionResult>);

  triggerNotifications(opts.userId, result);
  return result;
}

function triggerNotifications(userId: string, result: {
  leveledUp?: boolean;
  newLevel?: number;
  newTitle?: string;
  unlockedAchievements: { id: string; title: string }[];
  xpGained: number;
  coinsGained: number;
  questProgress: { questId: string; progress: number; target: number; completed: boolean }[];
}): void {
  if (result.leveledUp && result.newLevel) {
    createNotification(userId, "level_up", `Level ${result.newLevel} — ${result.newTitle}`, "You leveled up! Visit your profile to see your new title.").catch(() => {});
  }
  for (const ach of result.unlockedAchievements) {
    createNotification(userId, "achievement", ach.title, "Achievement unlocked!").catch(() => {});
  }
  for (const qp of result.questProgress) {
    if (qp.completed) {
      createNotification(userId, "quest_complete", "Quest completed!", "Claim your reward on the quest board.").catch(() => {});
    }
  }
}
