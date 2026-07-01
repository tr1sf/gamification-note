import type { BossAbility } from "./abilities";
import { applyBossAbility } from "./abilities";

export function calculateBossDamage(params: {
  actionType: "note" | "quiz" | "habit" | "focus";
  structureScore?: number;
  quizAccuracy?: number;
  quizStreak?: number;
  habitStreak?: number;
  comboCount?: number;
  consecutiveDays?: number;
  bossAbility?: BossAbility | null;
  bossCurrentHp?: number;
  bossMaxHp?: number;
  attacksToday?: number;
  questCompletedToday?: boolean;
  usedTypesToday?: Set<string>;
}): { damage: number; message: string | null } {
  let damage = 0;
  switch (params.actionType) {
    case "note":
      damage = 5 * Math.max(1, (params.structureScore || 5) / 5);
      break;
    case "quiz":
      damage = Math.round(
        10 * (1 + Math.min(params.quizAccuracy || 0, 1)) * (1 + Math.min(params.quizStreak || 0, 20) * 0.2)
      );
      break;
    case "habit":
      damage = 3 + Math.min(params.habitStreak || 0, 50);
      break;
    case "focus":
      damage = 5;
      break;
  }
  damage = Math.min(damage, 200);

  if (params.bossAbility) {
    return applyBossAbility(params.bossAbility, {
      actionType: params.actionType,
      damage,
      bossCurrentHp: params.bossCurrentHp ?? 0,
      bossMaxHp: params.bossMaxHp ?? 100,
      attacksToday: params.attacksToday,
      questCompletedToday: params.questCompletedToday,
      usedTypesToday: params.usedTypesToday,
    });
  }

  return { damage, message: null };
}

export function calculateBossDamageRaw(params: {
  actionType: "note" | "quiz" | "habit" | "focus";
  structureScore?: number;
  quizAccuracy?: number;
  quizStreak?: number;
  habitStreak?: number;
}): number {
  return calculateBossDamage(params).damage;
}
