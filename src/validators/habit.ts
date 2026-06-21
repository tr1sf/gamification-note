import { z } from "zod";

// Rewards are server-capped — user can set custom habits but XP/coin
// rewards are fixed to prevent self-assigning huge rewards.
export const HABIT_XP_REWARD = 5;
export const HABIT_COIN_REWARD = 1;
export const MAX_HABITS = 10;

export const createHabitSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  icon: z.string().max(8).optional(),
});

export const updateHabitSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional(),
  icon: z.string().max(8).optional(),
  isArchived: z.boolean().optional(),
});
