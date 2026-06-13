import type { Prisma } from "@prisma/client";
import { prisma as db } from "~/lib/db";
import { calculateXP } from "./calculators/xp-calculator";
import { calculateCoins } from "./calculators/coin-calculator";
import { calculateLevel, getLevelTitle } from "./calculators/level-calculator";
import { checkQuestProgress } from "./quests/quest-checker";
import { rotateQuestsIfNeeded } from "./quests/quest-rotation";
import { checkAchievements } from "./achievements/achievement-checker";
import { createNotification } from "~/lib/socket/notifications";

export interface ActionContext {
  userId: string;
  actionType: "create_note" | "update_note" | "make_public" | "daily_login" | "complete_quest" | "join_guild" | "create_guild" | "ai_summarize";
  metadata?: Record<string, unknown>;
}

export interface ActionResult {
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel?: number;
  newTitle?: string;
  unlockedAchievements: { id: string; title: string }[];
  questProgress: { questId: string; progress: number; target: number; completed: boolean }[];
}

export async function processAction(ctx: ActionContext): Promise<ActionResult> {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRaw<Array<{ xp: number; coins: number; level: number }>>`
      SELECT xp, coins, level FROM "User" WHERE id = ${ctx.userId}::uuid FOR UPDATE
    `;
    const user = rows[0];

    const xpGained = calculateXP(ctx.actionType, ctx.metadata);
    const coinsGained = calculateCoins(ctx.actionType, ctx.metadata);

    const newXp = user.xp + xpGained;
    const newLevel = calculateLevel(newXp);
    const leveledUp = newLevel > user.level;

    await tx.user.update({
      where: { id: ctx.userId },
      data: {
        xp: { increment: xpGained },
        coins: { increment: coinsGained },
        ...(leveledUp ? { level: newLevel, title: getLevelTitle(newLevel) } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: ctx.userId,
        actionType: ctx.actionType,
        xpChange: xpGained,
        coinChange: coinsGained,
        metadata: (ctx.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    await rotateQuestsIfNeeded(tx, ctx.userId);

    const questProgress = await checkQuestProgress(tx, ctx.userId, ctx.actionType, ctx.metadata);

    const unlockedAchievements = await checkAchievements(tx, ctx.userId, ctx.actionType, ctx.metadata);

    return {
      xpGained,
      coinsGained,
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined,
      newTitle: leveledUp ? getLevelTitle(newLevel) : undefined,
      unlockedAchievements,
      questProgress,
    };
  }) as Promise<ActionResult>;
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

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRaw<Array<{ xp: number; level: number }>>`
      SELECT xp, level FROM "User" WHERE id = ${opts.userId}::uuid FOR UPDATE
    `;
    const user = rows[0];
    const newXp = user.xp + xpGained;
    const newLevel = calculateLevel(newXp);
    const leveledUp = newLevel > user.level;

    await tx.user.update({
      where: { id: opts.userId },
      data: {
        xp: { increment: xpGained },
        coins: { increment: coinsGained },
        ...(leveledUp ? { level: newLevel, title: getLevelTitle(newLevel) } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: opts.userId,
        actionType: opts.actionType,
        xpChange: xpGained,
        coinChange: coinsGained,
        metadata: (opts.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    return {
      xpGained,
      coinsGained,
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined,
      newTitle: leveledUp ? getLevelTitle(newLevel) : undefined,
      unlockedAchievements: [],
      questProgress: [],
    } as ActionResult;
  }) as Promise<ActionResult>;
}

export function triggerActionNotifications(userId: string, result: ActionResult): void {
  triggerNotifications(userId, result);
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
