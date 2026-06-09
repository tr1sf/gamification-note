import {
  XP_CREATE_NOTE,
  XP_WRITE_WORDS_PER_100,
  XP_WRITE_WORDS_MAX,
  XP_MAKE_PUBLIC,
  XP_DAILY_LOGIN,
  XP_DAILY_STREAK_MULTIPLIER,
} from "../constants";

export function calculateXP(actionType: string, metadata?: Record<string, unknown>): number {
  switch (actionType) {
    case "create_note": {
      const wordCount = typeof metadata?.wordCount === "number" ? metadata.wordCount : 0;
      const wordBonus = Math.min(Math.floor(wordCount / 100) * XP_WRITE_WORDS_PER_100, XP_WRITE_WORDS_MAX);
      return XP_CREATE_NOTE + wordBonus;
    }
    case "write_words": {
      const wordCount = typeof metadata?.wordCount === "number" ? metadata.wordCount : 0;
      return Math.min(Math.floor(wordCount / 100) * XP_WRITE_WORDS_PER_100, XP_WRITE_WORDS_MAX);
    }
    case "make_public":
      return XP_MAKE_PUBLIC;
    case "daily_login": {
      const streak = typeof metadata?.streak === "number" ? metadata.streak : 0;
      return XP_DAILY_LOGIN + streak * XP_DAILY_STREAK_MULTIPLIER;
    }
    case "complete_quest":
      return typeof metadata?.xpReward === "number" ? metadata.xpReward : 0;
    case "unlock_achievement":
      return typeof metadata?.xpReward === "number" ? metadata.xpReward : 0;
    case "join_guild":
      return 0;
    case "create_guild":
      return 0;
    default:
      return 0;
  }
}
