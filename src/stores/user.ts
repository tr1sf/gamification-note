import { createSignal } from "solid-js";

export interface GamificationState {
  xp: number;
  coins: number;
  level: number;
  title: string;
  streak: number;
}

const [gamification, setGamification] = createSignal<GamificationState>({
  xp: 0,
  coins: 0,
  level: 1,
  title: "Novice Scribe",
  streak: 0,
});

export { gamification };

export function xpForLevel(level: number): number {
  return Math.floor(level * 500 + Math.pow(level, 2) * 50);
}

export function xpProgressInLevel(xp: number, level: number): { current: number; needed: number } {
  const prevLevelXp = level > 1 ? xpForLevel(level - 1) : 0;
  const nextLevelXp = xpForLevel(level);
  const totalNeeded = nextLevelXp - prevLevelXp;
  const current = xp - prevLevelXp;
  return { current: Math.max(0, current), needed: totalNeeded };
}

export function syncFromUser(userData: { xp: number; coins: number; level: number; title: string; streak?: number }) {
  setGamification((prev) => ({ ...prev, ...userData }));
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
