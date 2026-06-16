export const XP_CREATE_NOTE = 10;
export const XP_WRITE_WORDS_PER_100 = 1;
export const XP_WRITE_WORDS_MAX = 50;
export const XP_MAKE_PUBLIC = 5;
export const XP_DAILY_LOGIN = 5;
export const XP_DAILY_STREAK_MULTIPLIER = 5;
export const XP_AI_SUMMARIZE = 15;

// Phase B: Quality-based actions
export const XP_REVIEW_NOTE = 5;
export const XP_STRUCTURED_NOTE = 8;
export const XP_EXPORT_NOTE = 3;
export const XP_SHARE_NOTE = 5;
export const XP_ADD_LINK = 3;

export const COIN_DAILY_LOGIN = 5;
export const COIN_AI_SUMMARIZE = 3;
export const COIN_REVIEW_NOTE = 1;
export const COIN_EXPORT_NOTE = 1;
export const COIN_SHARE_NOTE = 2;

// Challenge system
export const XP_COMPLETE_CHALLENGE_ACTION = 5;
export const XP_CREATE_CHALLENGE = 5;
export const COIN_COMPLETE_CHALLENGE_ACTION = 1;

export const LEVEL_BASE_XP = 100;

// Anti-spam: diminishing returns per daily note count
export const XP_CREATE_NOTE_TIERS: Array<{ max: number; xp: number }> = [
  { max: 3, xp: 10 },
  { max: 6, xp: 7 },
  { max: 10, xp: 5 },
  { max: 15, xp: 3 },
  { max: 50, xp: 1 },
];
export const XP_QUALITY_BONUS = 5;
export const QUALITY_SCORE_THRESHOLD = 3;
export const QUALITY_BONUS_THRESHOLD = 7;
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.8;
// Reflection depth bonus (journaler path)
export const REFLECTION_XP_BONUS = 5;
export const REFLECTION_COIN_BONUS = 3;

export const DELETE_PENALTY_XP = 5;
export const DELETE_PENALTY_MAX_WORDS = 50;
export const DELETE_PENALTY_MAX_AGE_MS = 5 * 60 * 1000;
