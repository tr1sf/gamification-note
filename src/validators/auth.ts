import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric'),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  login: z.string().min(1, "Email or username required"),
  password: z.string().min(1, "Password is required"),
});

// ── Security-question password recovery (no email) ──────────────────────────
export const securityQuestionSchema = z.object({
  question: z.string().min(5, "Question is too short").max(150),
  answer: z.string().min(1, "Answer is required").max(100),
});

export const forgotQuestionSchema = z.object({
  login: z.string().min(1, "Email or username required"),
});

export const forgotResetSchema = z.object({
  login: z.string().min(1, "Email or username required"),
  answer: z.string().min(1, "Answer is required").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SecurityQuestionInput = z.infer<typeof securityQuestionSchema>;
