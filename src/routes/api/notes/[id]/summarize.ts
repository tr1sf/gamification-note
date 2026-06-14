import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { summarizeNote } from "~/lib/ai/summarize";
import { isAiAvailable } from "~/lib/ai/openai";
import { processAction } from "~/lib/gamification/engine";
import { track } from "~/lib/analytics/tracker";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  if (!isAiAvailable()) {
    return error("AI_NOT_CONFIGURED", "AI features are not configured. Set GEMINI_API_KEY in environment.", 400);
  }

  const note = await prisma.note.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, userId: true, content: true, aiSummary: true },
  });

  if (!note) return error("NOT_FOUND", "Note not found", 404);
  if (note.userId !== user.userId) return error("FORBIDDEN", "Not your note", 403);

  if (note.aiSummary) {
    return error("ALREADY_SUMMARIZED", "This note already has an AI summary", 400);
  }

  let summary: string;
  try {
    summary = await summarizeNote(note.content);
  } catch (err: any) {
    if (err.message === "NOTE_TOO_SHORT") {
      return error("NOTE_TOO_SHORT", "Note is too short to summarize (minimum 30 words)", 400);
    }
    if (err.message === "AI_NOT_CONFIGURED") {
      return error("AI_NOT_CONFIGURED", "AI features are not configured", 400);
    }
    console.error("[summarize] OpenAI error:", err);
    return error("AI_SERVICE_ERROR", "AI service is currently unavailable. Please try again later.", 503);
  }

  await prisma.note.update({
    where: { id: params.id },
    data: { aiSummary: summary },
  });

  const gamification = await processAction({
    userId: user.userId,
    actionType: "ai_summarize",
    metadata: { noteId: note.id },
  });

  track({
    userId: user.userId,
    actionType: "note_ai_summarize",
    metadata: { noteId: note.id, noteTitle: note.title },
  });

  return success({ summary, gamification });
}
