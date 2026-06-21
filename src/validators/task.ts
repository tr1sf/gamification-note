import { z } from "zod";

// Rewards are capped low — guild tasks are collaborative, not self-farming.
export const TASK_XP_CAP = 20;
export const TASK_COIN_CAP = 10;

export const createTaskSchema = z.object({
  assigneeId: z.string().uuid(),
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  xpReward: z.number().int().min(0).max(TASK_XP_CAP).optional(),
  coinReward: z.number().int().min(0).max(TASK_COIN_CAP).optional(),
  dueAt: z.string().datetime().optional(),
});

export const reviewTaskSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reviewNote: z.string().max(500).optional(),
});
