import { LEVEL_BASE_XP } from "../constants";

const LEVEL_TITLES: Record<number, string> = {
  1: "Novice Scribe",
  5: "Apprentice Scribe",
  10: "Scribe",
  20: "Scholar",
  30: "Archivist",
  50: "Grand Archivist",
  75: "Lore Master",
  100: "Tavern Sage",
};

const TITLE_THRESHOLDS = Object.keys(LEVEL_TITLES)
  .map(Number)
  .sort((a, b) => b - a);

export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / LEVEL_BASE_XP));
}

export function xpForNextLevel(currentLevel: number): number {
  return (currentLevel + 1) * (currentLevel + 1) * LEVEL_BASE_XP;
}

export function getLevelTitle(level: number): string {
  for (const threshold of TITLE_THRESHOLDS) {
    if (level >= threshold) {
      return LEVEL_TITLES[threshold];
    }
  }
  return LEVEL_TITLES[1];
}
