export function calculateBossDamage(params: {
  actionType: "note" | "quiz" | "habit" | "focus";
  structureScore?: number;
  quizAccuracy?: number;
  quizStreak?: number;
  habitStreak?: number;
  comboCount?: number;
  consecutiveDays?: number;
}): number {
  let damage = 0;
  switch (params.actionType) {
    case "note":
      damage = 5 * Math.max(1, (params.structureScore || 5) / 5);
      break;
    case "quiz":
      // Clamp accuracy to [0, 1] and streak to [0, 20] to prevent inflated damage.
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
  // Global damage cap prevents one-shot kills from any path.
  return Math.min(damage, 200);
}
