import { z } from 'zod';

export const createGuildSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().max(200).optional(),
  isPublic: z.boolean().default(true),
});

export const updateGuildSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().max(200).optional(),
});

export const joinGuildSchema = z.object({
  inviteCode: z.string().optional(),
});
