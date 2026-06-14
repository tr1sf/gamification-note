import { LEVEL_BASE_XP } from "../constants";

const LEVEL_TITLES: Record<number, string> = {
  1: "Novice Scribe",
  5: "Apprentice Scribe",
  10: "Scribe",
  15: "Senior Scribe",
  20: "Scholar",
  30: "Archivist",
  40: "Master Archivist",
  50: "Grand Archivist",
  60: "Sage",
  75: "Lore Master",
  100: "Tavern Sage",
};

const TITLE_THRESHOLDS = Object.keys(LEVEL_TITLES)
  .map(Number)
  .sort((a, b) => b - a);

export function calculateLevel(xp: number): number {
  // Levels are 1-based: a brand-new user (0 XP) is level 1, not level 0.
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / LEVEL_BASE_XP)));
}

export function getLevelTitle(level: number): string {
  for (const threshold of TITLE_THRESHOLDS) {
    if (level >= threshold) {
      return LEVEL_TITLES[threshold];
    }
  }
  return LEVEL_TITLES[1];
}
