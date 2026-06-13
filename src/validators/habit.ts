import { z } from "zod";

export const createHabitSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  icon: z.string().max(8).optional(),
  xpReward: z.number().int().min(0).max(100).optional(),
  coinReward: z.number().int().min(0).max(50).optional(),
});

export const updateHabitSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional(),
  icon: z.string().max(8).optional(),
  xpReward: z.number().int().min(0).max(100).optional(),
  coinReward: z.number().int().min(0).max(50).optional(),
  isArchived: z.boolean().optional(),
});
