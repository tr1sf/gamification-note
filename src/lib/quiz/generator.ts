import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "~/lib/env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY!);
const QUIZ_CACHE = new Map<string, any>();

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

export async function generateQuiz(content: string, wordCount: number): Promise<QuizQuestion[]> {
  if (wordCount < 100) throw new Error("NOTE_TOO_SHORT");

  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(content.slice(0, 500)));
  const key = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  if (QUIZ_CACHE.has(key)) return QUIZ_CACHE.get(key);

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `You are an expert quiz generator. Given a student's note, generate 3 multiple-choice questions in the SAME LANGUAGE as the input. Each question tests conceptual understanding, not memorization. Return ONLY valid JSON array.

Format: [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "difficulty": "easy|medium|hard"}]

Note content:
${content.slice(0, 3000)}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json|```/g, "").trim();
  const questions = JSON.parse(cleaned) as QuizQuestion[];

  QUIZ_CACHE.set(key, questions);
  return questions.slice(0, 3);
}
