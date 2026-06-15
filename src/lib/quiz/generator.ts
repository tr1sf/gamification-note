import { isAiAvailable, getClient, QUIZ_MODEL } from "~/lib/ai/openai";

const QUIZ_CACHE = new Map<string, QuizQuestion[]>();
const CACHE_MAX_SIZE = 200;

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

export function isQuizAiAvailable(): boolean {
  return isAiAvailable();
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  // Remove markdown code fences
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  // Try to find JSON array
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  // Try to find JSON object with questions key
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const obj = JSON.parse(objMatch[0]);
      if (Array.isArray(obj.questions)) return JSON.stringify(obj.questions);
      if (Array.isArray(obj.quizzes)) return JSON.stringify(obj.quizzes);
      // If it's an object with numeric keys, extract values
      const values = Object.values(obj).filter(v => typeof v === "object" && v !== null);
      if (values.length > 0) return JSON.stringify(values);
    } catch {}
    return objMatch[0];
  }
  return cleaned;
}

function validateQuestion(q: any, index: number): QuizQuestion | null {
  if (!q || typeof q !== "object") return null;
  if (!q.question || typeof q.question !== "string") return null;
  if (!Array.isArray(q.options) || q.options.length !== 4) return null;
  if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 3) return null;
  for (const opt of q.options) {
    if (typeof opt !== "string") return null;
  }
  return {
    question: q.question,
    options: q.options as [string, string, string, string],
    correctIndex: q.correctIndex,
    explanation: typeof q.explanation === "string" ? q.explanation : "",
    difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
  };
}

export async function generateQuiz(content: string, wordCount: number): Promise<QuizQuestion[]> {
  if (wordCount < 100) throw new Error("NOTE_TOO_SHORT");
  if (!isAiAvailable()) throw new Error("AI_NOT_CONFIGURED");

  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(content.slice(0, 500)));
  const cacheKey = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (QUIZ_CACHE.has(cacheKey)) return QUIZ_CACHE.get(cacheKey)!;

  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: QUIZ_MODEL,
    messages: [
      {
        role: "system",
        content: `You are an expert quiz generator. Given a student's note, generate exactly 3 multiple-choice questions in the SAME LANGUAGE as the input. Each question must have exactly 4 options (A,B,C,D). Each question tests conceptual understanding, not memorization.

Return ONLY a JSON array. No markdown, no code fences, no extra text.

Format: [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "difficulty": "easy|medium|hard"}]`,
      },
      {
        role: "user",
        content: `Note content:\n${content.slice(0, 3000)}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const text = response.choices[0]?.message?.content || "";
  const cleaned = cleanJsonResponse(text);

  let questions: QuizQuestion[] = [];
  try {
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    questions = arr.map((q, i) => validateQuestion(q, i)).filter(Boolean) as QuizQuestion[];
  } catch (e) {
    console.error("[quiz] JSON parse failed. Raw response:", text.slice(0, 500));
    console.error("[quiz] Cleaned:", cleaned.slice(0, 500));
    throw new Error("AI_PARSE_ERROR");
  }

  if (questions.length === 0) throw new Error("AI_EMPTY_RESPONSE");

  // Cache with size limit
  if (QUIZ_CACHE.size >= CACHE_MAX_SIZE) {
    const firstKey = QUIZ_CACHE.keys().next().value;
    if (firstKey) QUIZ_CACHE.delete(firstKey);
  }
  QUIZ_CACHE.set(cacheKey, questions);
  return questions.slice(0, 3);
}
