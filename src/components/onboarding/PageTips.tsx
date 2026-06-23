import { onMount } from "solid-js";

type TooltipConfig = {
  path: string;
  title: string;
  message: string;
  icon: string;
};

const TOOLTIPS: TooltipConfig[] = [
  {
    path: "/boss/",
    title: "Boss Fight",
    message: "Bosses take damage when you write notes, take quizzes, or check in habits. Each boss has a unique ability — find its weakness!",
    icon: "⚔️",
  },
  {
    path: "/quiz",
    title: "Quiz Review",
    message: "AI-generated quizzes from your notes. Higher accuracy = more boss damage. Spaced repetition schedules reviews at 1-3-7-30 day intervals.",
    icon: "🧠",
  },
  {
    path: "/habits",
    title: "Daily Rituals",
    message: "Track daily habits with streak tracking. Each check-in damages active bosses and earns XP. Max 10 active habits.",
    icon: "🌅",
  },
  {
    path: "/minigames/potion",
    title: "Potion Match",
    message: "Match emojis with English words to earn XP. Difficulty scales with your level — harder themes unlock as you level up!",
    icon: "🧪",
  },
  {
    path: "/shop",
    title: "Shop",
    message: "Spend your hard-earned coins on avatar frames, badges, name colors, consumables, and themes! New items added regularly.",
    icon: "🏪",
  },
  {
    path: "/challenges",
    title: "Challenges",
    message: "Create personal challenges with action-based goals. Complete actions to earn bonus XP. Bosses appear at the top!",
    icon: "🏆",
  },
];

const STORAGE_KEY = "tavernotex_page_tips_seen";

function getSeen(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function markSeen(path: string) {
  const seen = getSeen();
  seen.push(path);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
}

export function getTooltipForPath(pathname: string): TooltipConfig | null {
  const seen = getSeen();
  for (const t of TOOLTIPS) {
    if (pathname.startsWith(t.path) && !seen.includes(t.path)) {
      markSeen(t.path);
      return t;
    }
  }
  return null;
}

export function resetPageTips() {
  localStorage.removeItem(STORAGE_KEY);
}
