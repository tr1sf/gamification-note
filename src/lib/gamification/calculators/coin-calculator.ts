import { COIN_DAILY_LOGIN, COIN_AI_SUMMARIZE, COIN_REVIEW_NOTE, COIN_EXPORT_NOTE, COIN_SHARE_NOTE } from "../constants";

export function calculateCoins(actionType: string, metadata?: Record<string, unknown>): number {
  switch (actionType) {
    case "daily_login":
      return COIN_DAILY_LOGIN;
    case "complete_quest":
      return typeof metadata?.coinReward === "number" ? metadata.coinReward : 0;
    case "ai_summarize":
      return COIN_AI_SUMMARIZE;
    case "review_note":
      return COIN_REVIEW_NOTE;
    case "export_note":
      return COIN_EXPORT_NOTE;
    case "share_note":
      return COIN_SHARE_NOTE;
    default:
      return 0;
  }
}
