export type UserPath = "student" | "professional" | "journaler";

export interface PathUnlock {
  level: number;
  feature: string;
  description: string;
}

export const PATH_UNLOCKS: Record<UserPath, PathUnlock[]> = {
  student: [
    { level: 1, feature: "Notes", description: "Write and organize scrolls" },
    { level: 2, feature: "Daily Quests", description: "Complete quests to earn XP" },
    { level: 4, feature: "AI Quiz", description: "Auto-generated quizzes from notes" },
    { level: 5, feature: "Spaced Repetition", description: "Review at optimal intervals" },
    { level: 7, feature: "Boss Fight", description: "Defeat daily minions" },
    { level: 10, feature: "Weekly Elite", description: "Challenge weekly bosses" },
    { level: 15, feature: "Guild Creation", description: "Form a study circle" },
    { level: 20, feature: "Raid Boss", description: "Summon guild raid bosses" },
  ],
  professional: [
    { level: 1, feature: "Notes", description: "Capture ideas instantly" },
    { level: 2, feature: "Full-text Search", description: "Find anything in seconds" },
    { level: 4, feature: "AI Summarize", description: "Condense meeting notes" },
    { level: 5, feature: "Markdown Export", description: "Export to .md files" },
    { level: 7, feature: "Task Management", description: "Track todos with deadlines" },
    { level: 10, feature: "Team Workspace", description: "Create guilds for work" },
    { level: 15, feature: "Public Sharing", description: "Publish notes as web pages" },
    { level: 20, feature: "Analytics Dashboard", description: "Track productivity trends" },
  ],
  journaler: [
    { level: 1, feature: "Notes", description: "Your personal journal" },
    { level: 2, feature: "Mood Tracker", description: "Log your daily emotions" },
    { level: 3, feature: "Daily Prompts", description: "Guided reflection questions" },
    { level: 5, feature: "Streak Rewards", description: "Bonus coins for streaks" },
    { level: 7, feature: "Photo Journal", description: "Attach images to entries" },
    { level: 10, feature: "Calendar View", description: "See your journey by date" },
    { level: 15, feature: "Custom Themes", description: "Unlock journal-exclusive themes" },
    { level: 20, feature: "Beautiful Export", description: "Export as printable PDF" },
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
