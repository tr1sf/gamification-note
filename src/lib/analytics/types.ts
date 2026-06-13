export interface AuditMetadata {
  // App usage
  sessionId?: string;
  device?: "desktop" | "mobile" | "tablet";
  duration?: number;
  page?: string;
  tab?: string;

  // Note
  noteId?: string;
  noteTitle?: string;
  wordCount?: number;
  wordDelta?: number;
  timeSinceCreated?: number;
  timeSinceLastView?: number;
  isOwnNote?: boolean;
  daysSinceCreated?: number;
  shareType?: "public" | "link";
  exportFormat?: "md" | "txt" | "html";

  // Note quality
  structureScore?: number;
  hasH1?: boolean;
  hasH2?: boolean;
  hasList?: boolean;
  hasCode?: boolean;
  hasImage?: boolean;
  linkCount?: number;
  tagCount?: number;
  hasCategory?: boolean;
  hasAiSummary?: boolean;
  isBlockContent?: boolean;

  // Gamification
  questId?: string;
  questTitle?: string;
  questType?: string;
  questTarget?: number;
  questProgress?: number;
  questDuration?: number;
  declineReason?: string;
  achievementId?: string;
  achievementTitle?: string;
  levelBefore?: number;
  levelAfter?: number;
  xpReward?: number;
  coinReward?: number;
  itemType?: string;
  itemName?: string;
  coinCost?: number;
  coinBalance?: number;

  // Habit
  habitId?: string;
  habitTitle?: string;
  streakBefore?: number;
  streakAfter?: number;
  maxStreak?: number;

  // Community
  guildId?: string;
  guildName?: string;
  role?: string;
  messageLength?: number;
  taskId?: string;
  taskTitle?: string;
  assigneeId?: string;
  viewerId?: string;
  viewerCount?: number;
  commentLength?: number;

  // Search
  query?: string;
  resultCount?: number;
}

export const ANALYTICS_ACTION_TYPES = [
  "session_start",
  "session_end",
  "page_view",
  "dashboard_open",
  "note_create",
  "note_edit",
  "note_view",
  "note_delete",
  "note_search",
  "note_share",
  "note_export",
  "note_ai_summarize",
  "note_review",
  "note_quality_score",
  "quest_view",
  "quest_accept",
  "quest_complete",
  "quest_decline",
  "reward_claim",
  "level_up",
  "achievement_unlock",
  "coin_spend",
  "xp_gained",
  "habit_checkin",
  "streak_maintain",
  "streak_break",
  "daily_login",
  "guild_join",
  "guild_leave",
  "guild_message",
  "guild_task_create",
  "guild_task_complete",
  "share_view",
  "profile_view",
  "survey_start",
  "survey_question",
  "survey_complete",
  "survey_abandon",
  "feedback_submit",
] as const;

export type AnalyticsActionType = (typeof ANALYTICS_ACTION_TYPES)[number];
