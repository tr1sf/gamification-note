export type UserPath = "student" | "professional" | "journaler";

export interface PathUnlock {
  level: number;
  feature: string;
  description: string;
}

// Path descriptions shown in onboarding hover tooltips
export const PATH_DESCRIPTIONS: Record<UserPath, string> = {
  student: "Master your coursework with AI quiz generation, spaced repetition, and boss fights that make studying feel like an adventure. Early access to learning tools.",
  professional: "Your productivity command center. AI summarizes meetings, tasks track deadlines, and team workspaces keep projects moving. Early access to productivity tools.",
  journaler: "Your personal sanctuary for daily reflection. Mood tracking, guided prompts, and beautiful exports help you capture life's moments. Early access to wellness tools.",
};

// Every feature exists in every path — just at different unlock levels.
// Path specialty features unlock ~2-4 levels earlier than cross-path ones.
// Features are ordered by typical unlock level across all paths.
export const PATH_UNLOCKS: Record<UserPath, PathUnlock[]> = {
  student: [
    { level: 1,  feature: "Notes",           description: "Write and organize scrolls" },
    { level: 2,  feature: "Daily Quests",     description: "Complete quests to earn XP" },
    // ── Student specialties (early) ──
    { level: 4,  feature: "AI Quiz",          description: "Auto-generated MCQ quizzes from your notes — test your knowledge" },
    { level: 5,  feature: "Spaced Repetition",description: "Quizzes auto-review at optimal 1/3/7/30 day intervals" },
    { level: 7,  feature: "Boss Fight",       description: "Defeat daily minions and weekly elites with quiz damage" },
    // ── Cross-path (medium) ──
    { level: 8,  feature: "AI Summarize",     description: "AI condenses long notes into 3-5 bullet points" },
    { level: 10, feature: "Habit Tracker",    description: "Build daily rituals with streak tracking" },
    { level: 12, feature: "Guilds",           description: "Form a study circle — share notes, chat, and tackle raid bosses together" },
    { level: 14, feature: "Analytics",        description: "Dashboard tracking your notes, quiz accuracy, and boss kills" },
    // ── Student late-game ──
    { level: 16, feature: "Markdown Export",  description: "Export notes to clean .md files" },
    { level: 18, feature: "Custom Themes",    description: "Unlock and equip exclusive visual themes" },
    { level: 20, feature: "Raid Boss",        description: "Summon epic guild raid bosses for massive rewards" },
  ],
  professional: [
    { level: 1,  feature: "Notes",           description: "Capture ideas, meetings, and to-dos instantly" },
    { level: 2,  feature: "Daily Quests",     description: "Complete quests to earn XP" },
    // ── Professional specialties (early) ──
    { level: 4,  feature: "AI Summarize",     description: "AI condenses meeting notes into 3-5 bullet points" },
    { level: 5,  feature: "Markdown Export",  description: "Export notes to .md for sharing with your team" },
    { level: 7,  feature: "Habit Tracker",    description: "Build productive daily rituals with streak tracking" },
    // ── Cross-path (medium) ──
    { level: 8,  feature: "AI Quiz",          description: "Auto-generated MCQ quizzes — test your retention after meetings" },
    { level: 10, feature: "Guilds",           description: "Create a team workspace — share notes, assign tasks, real-time chat" },
    { level: 12, feature: "Boss Fight",       description: "Defeat productivity-blocking bosses to stay focused" },
    { level: 14, feature: "Analytics",        description: "Dashboard tracking your notes, productivity trends, and team activity" },
    // ── Professional late-game ──
    { level: 16, feature: "Spaced Repetition",description: "Review key meeting takeaways at optimal intervals" },
    { level: 18, feature: "Custom Themes",    description: "Customize your workspace with professional themes" },
    { level: 20, feature: "Raid Boss",        description: "Tackle company-wide productivity challenges as a team" },
  ],
  journaler: [
    { level: 1,  feature: "Notes",           description: "Your personal journal — private by default" },
    { level: 2,  feature: "Daily Quests",     description: "Complete quests to earn XP" },
    // ── Journaler specialties (early) ──
    { level: 3,  feature: "Daily Prompts",    description: "Guided reflection questions: 'What are you grateful for today?'" },
    { level: 4,  feature: "Streak Boost",     description: "Bonus coins and XP for maintaining journal streaks" },
    { level: 6,  feature: "Custom Themes",    description: "Unlock beautiful journal-exclusive visual themes early" },
    // ── Cross-path (medium) ──
    { level: 8,  feature: "AI Summarize",     description: "AI extracts key themes and emotions from your journal entries" },
    { level: 10, feature: "Guilds",           description: "Join a support circle — share reflections and encouragement" },
    { level: 12, feature: "AI Quiz",          description: "Quiz yourself on personal growth insights from your journal" },
    { level: 14, feature: "Habit Tracker",    description: "Track gratitude, meditation, and wellness habits" },
    // ── Journaler late-game ──
    { level: 16, feature: "Boss Fight",       description: "Gentle challenges that celebrate personal growth milestones" },
    { level: 18, feature: "Analytics",        description: "Beautiful insights: mood trends, writing patterns, growth journey" },
    { level: 20, feature: "Markdown Export",  description: "Export your journal as a beautifully formatted keepsake" },
  ],
};

export function getNextUnlock(path: UserPath | null, currentLevel: number): PathUnlock | null {
  if (!path) return null;
  const unlocks = PATH_UNLOCKS[path];
  return unlocks.find((u) => u.level > currentLevel) || null;
}

export function getUnlockedFeatures(path: UserPath | null, currentLevel: number): string[] {
  if (!path) return [];
  return PATH_UNLOCKS[path]
    .filter((u) => u.level <= currentLevel)
    .map((u) => u.feature);
}
