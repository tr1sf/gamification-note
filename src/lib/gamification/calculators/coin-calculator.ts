import { COIN_DAILY_LOGIN, COIN_AI_SUMMARIZE } from "../constants";

export function calculateCoins(actionType: string, metadata?: Record<string, unknown>): number {
  switch (actionType) {
    case "daily_login":
      return COIN_DAILY_LOGIN;
    case "complete_quest":
      return typeof metadata?.coinReward === "number" ? metadata.coinReward : 0;
    case "ai_summarize":
      return COIN_AI_SUMMARIZE;
    default:
      return 0;
  }
}
