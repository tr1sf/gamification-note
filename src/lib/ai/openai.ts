import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../env";

const genAI = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : null;

export function isAiAvailable(): boolean {
  return genAI !== null;
}

export function getModel() {
  if (!genAI) return null;
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}
