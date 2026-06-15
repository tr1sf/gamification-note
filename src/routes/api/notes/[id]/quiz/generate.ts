import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { generateQuiz, isQuizAiAvailable } from "~/lib/quiz/generator";
import { rateLimit } from "~/lib/rate-limit";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  // Rate limit: 10 quiz generations per minute per user
  if (!rateLimit(`quiz:${user.userId}`, 10, 60000)) {
    return error("RATE_LIMITED", "Too many quiz generations. Try again shortly.", 429);
  }

  if (!isQuizAiAvailable()) {
    return error("AI_NOT_CONFIGURED", "AI features are not configured. Set GEMINI_API_KEY in environment.", 400);
  }

  const note = await prisma.note.findUnique({ where: { id: params.id }, select: { id: true, userId: true, content: true, wordCount: true, title: true } });
  if (!note) return error("NOT_FOUND", "Note not found", 404);
  if (note.userId !== user.userId) return error("FORBIDDEN", "Not your note", 403);

  const existing = await prisma.quiz.findUnique({ where: { noteId: params.id } });
  if (existing) return success(existing);

  try {
    const questions = await generateQuiz(note.content, note.wordCount);
    const quiz = await prisma.quiz.create({
      data: { noteId: note.id, userId: user.userId, questions: questions as any },
    });
    return success(quiz);
  } catch (e: any) {
    if (e.message === "NOTE_TOO_SHORT") return error("NOTE_TOO_SHORT", "Note must be at least 100 words", 400);
    if (e.message === "AI_NOT_CONFIGURED") return error("AI_NOT_CONFIGURED", "AI features are not configured", 400);
    if (e.message === "AI_PARSE_ERROR") return error("AI_ERROR", "AI generated invalid quiz format. Try again.", 500);
    if (e.message === "AI_EMPTY_RESPONSE") return error("AI_ERROR", "AI could not generate questions for this note", 500);
    return error("AI_ERROR", "Failed to generate quiz", 500);
  }
}
