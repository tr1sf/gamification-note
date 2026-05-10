import { z } from 'zod';

export const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
  category: z.string().max(50).optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string().max(30)).max(10).optional(),
  guildId: z.string().uuid().optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(100000).optional(),
  category: z.string().max(50).nullable().optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  guildId: z.string().uuid().nullable().optional(),
  version: z.number().int(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
