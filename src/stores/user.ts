import { createSignal } from "solid-js";

export interface GamificationState {
  xp: number;
  coins: number;
  level: number;
  title: string;
  streak: number;
  gamificationStyle: string;
}

const [gamification, setGamification] = createSignal<GamificationState>({
  xp: 0,
  coins: 0,
  level: 1,
  title: "Novice Scribe",
  streak: 0,
  gamificationStyle: "balanced",
});

export { gamification };

// Must mirror the server: src/lib/gamification/constants.ts (LEVEL_BASE_XP)
// and src/lib/gamification/calculators/level-calculator.ts:
//   calculateLevel(xp) = max(1, floor(sqrt(xp / LEVEL_BASE_XP)))
// => total XP required to *reach* level L is L² * LEVEL_BASE_XP (level 1 starts at 0).
const LEVEL_BASE_XP = 100;

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return level * level * LEVEL_BASE_XP;
}

export function xpProgressInLevel(xp: number, level: number): { current: number; needed: number } {
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const needed = Math.max(1, next - start);
  const current = Math.max(0, Math.min(xp - start, needed));
  return { current, needed };
}

export function syncFromUser(userData: { xp: number; coins: number; level: number; title: string; streak?: number; gamificationStyle?: string }) {
  setGamification((prev) => ({
    ...prev,
    xp: userData.xp,
    coins: userData.coins,
    level: userData.level,
    title: userData.title,
    ...(userData.streak !== undefined ? { streak: userData.streak } : {}),
    ...(userData.gamificationStyle ? { gamificationStyle: userData.gamificationStyle } : {}),
  }));
}

export function setCoins(coins: number) {
  setGamification((prev) => ({ ...prev, coins: Math.max(0, coins) }));
}

export function applyReward(result: {
  xpGained: number;
  coinsGained: number;
  leveledUp?: boolean;
  newLevel?: number;
  newTitle?: string;
}) {
  setGamification((prev) => ({
    ...prev,
    xp: Math.max(0, prev.xp + result.xpGained),
    coins: Math.max(0, prev.coins + result.coinsGained),
    ...(result.leveledUp ? { level: result.newLevel!, title: result.newTitle! } : {}),
  }));
}
