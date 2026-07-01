import { LEVEL_BASE_XP } from "../constants";

const LEVEL_TITLES: Record<number, string> = {
  1: "Novice Scribe",
  3: "Apprentice Scribe",
  5: "Scribe",
  10: "Senior Scribe",
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
  // Use sqrt(xp / 50) for a gentler curve.
  // Level 2: 200 XP (~2 notes), Level 3: 450 XP, Level 4: 800 XP
  if (xp <= 0) return 1;

  // Use sqrt(xp / 50) — half the base XP requirement for faster early leveling.
  // - Level 2: 200 XP (~2 notes)
  // - Level 3: 450 XP (~5 notes)
  // - Level 4: 800 XP (~8 notes)
  // - Level 5: 1250 XP (~13 notes)
  // - Level 10: 5000 XP
  // - Level 20: 20000 XP
  // Previous values were Level 2=400, Level 3=900, Level 4=1600 — too steep for day 1.
  const raw = Math.sqrt(Math.max(0, xp) / (LEVEL_BASE_XP / 2));
  return Math.max(1, Math.floor(raw));
}

export function getLevelTitle(level: number): string {
  for (const threshold of TITLE_THRESHOLDS) {
    if (level >= threshold) {
      return LEVEL_TITLES[threshold];
    }
  }
  return LEVEL_TITLES[1];
}
