import OpenAI from "openai";
import { env } from "~/lib/env";

function createClient(): OpenAI | null {
  const apiKey = env.NEURALWATT_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    baseURL: env.NEURALWATT_BASE_URL || "https://api.neuralwatt.com/v1",
    apiKey,
  });
}

const client = createClient();

export function isAiAvailable(): boolean {
  return client !== null;
}

export function getClient(): OpenAI {
  if (!client) throw new Error("AI_NOT_CONFIGURED");
  return client;
}

// Best model for quiz generation (has JSON mode, 262K context)
export const QUIZ_MODEL = "kimi-k2.5";

// Fast model for summarization
export const SUMMARIZE_MODEL = "glm-5.1-fast";
