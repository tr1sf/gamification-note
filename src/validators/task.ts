import { z } from "zod";

export const createTaskSchema = z.object({
  assigneeId: z.string().uuid(),
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  xpReward: z.number().int().min(0).max(500).optional(),
  coinReward: z.number().int().min(0).max(200).optional(),
  dueAt: z.string().datetime().optional(),
});

export const reviewTaskSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reviewNote: z.string().max(500).optional(),
});
