import { COIN_DAILY_LOGIN } from "../constants";

export function calculateCoins(actionType: string, metadata?: Record<string, unknown>): number {
  switch (actionType) {
    case "daily_login":
      return COIN_DAILY_LOGIN;
    case "complete_quest":
      return typeof metadata?.coinReward === "number" ? metadata.coinReward : 0;
    default:
      return 0;
  }
}
