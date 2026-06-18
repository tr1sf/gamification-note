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
      damage = Math.round(
        10 * (1 + (params.quizAccuracy || 0)) * (1 + (params.quizStreak || 0) * 0.2)
      );
      break;
    case "habit":
      damage = 3 + (params.habitStreak || 0);
      break;
    case "focus":
      damage = 5;
      break;
  }
  return damage;
}
