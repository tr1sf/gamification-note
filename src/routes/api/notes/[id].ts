import { prisma } from "~/lib/db";
import { updateNoteSchema } from "~/validators/note";
import { success, error } from "~/lib/api-response";
import { processAction } from "~/lib/gamification/engine";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { computeWordCount } from "~/lib/blocks";
import { track } from "~/lib/analytics/tracker";
import { DELETE_PENALTY_XP, DELETE_PENALTY_MAX_WORDS, DELETE_PENALTY_MAX_AGE_MS } from "~/lib/gamification/constants";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const note = await prisma.note.findUnique({
    where: { id: params.id, isDeleted: false },
    select: {
      id: true, title: true, content: true, category: true, tags: true,
      isPublic: true, wordCount: true, version: true,
      aiSummary: true, aiImageUrl: true, userId: true, guildId: true,
      createdAt: true, updatedAt: true,
    },
  });

  if (!note) {
    return error("NOT_FOUND", "Note not found", 404);
  }

  if (!note.isPublic && note.userId !== user.userId) {
    return error("FORBIDDEN", "Access denied", 403);
  }

  const daysSinceCreated = Math.floor(
    (Date.now() - note.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  track({
    userId: user.userId,
    actionType: "note_view",
    metadata: {
      noteId: note.id,
      noteTitle: note.title,
      isOwnNote: note.userId === user.userId,
      daysSinceCreated,
    },
  });

  if (daysSinceCreated > 7 && note.userId === user.userId) {
    track({
      userId: user.userId,
      actionType: "note_review",
      metadata: { noteId: note.id, noteTitle: note.title, daysSinceCreated },
    });
  }

  return success({
    ...note,
    isOwner: note.userId === user.userId,
  });
}

export async function PUT({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  const existing = await prisma.note.findUnique({
    where: { id: params.id },
    select: { id: true, isDeleted: true, userId: true, version: true, isPublic: true, wordCount: true },
  });
  if (!existing || existing.isDeleted) return error("NOT_FOUND", "Note not found", 404);
  if (existing.userId !== user.userId) return error("FORBIDDEN", "Not your note", 403);
  if (existing.version !== parsed.data.version) {
    return error("CONFLICT", "Note was modified by another session", 409);
  }

  const wasNotPublic = !existing.isPublic;
  const isBecomingPublic = wasNotPublic && parsed.data.isPublic === true;

  const updateData: any = { ...parsed.data, version: existing.version + 1 };
  if (updateData.content) {
    updateData.wordCount = computeWordCount(updateData.content);
  }

  const note = await prisma.note.update({
    where: { id: params.id },
    data: updateData,
    select: {
      id: true, title: true, content: true, category: true, tags: true,
      isPublic: true, wordCount: true, version: true, aiSummary: true,
      aiImageUrl: true, userId: true, guildId: true, createdAt: true, updatedAt: true,
    },
  });

  track({
    userId: user.userId,
    actionType: "note_edit",
    metadata: { noteId: note.id, noteTitle: note.title, wordCount: note.wordCount },
  });

  // Recycle bonus: if note was improved by 20+ words, award XP
  const wordDelta = note.wordCount - (existing.wordCount || 0);
  let recycleReward = null;
  if (wordDelta >= 20) {
    recycleReward = await processAction({
      userId: user.userId,
      actionType: "add_link", // Reuse existing action type for recycle XP
      metadata: { noteId: note.id, wordDelta, source: "recycle" },
    });
  }

  let gamification = null;
  if (isBecomingPublic) {
    gamification = await processAction({
      userId: user.userId,
      actionType: "make_public",
      metadata: { noteId: note.id },
    });
  }

  return success({ note, gamification, recycleReward });
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const existing = await prisma.note.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, wordCount: true, createdAt: true },
  });
  if (!existing) return error("NOT_FOUND", "Note not found", 404);
  if (existing.userId !== user.userId) return error("FORBIDDEN", "Not your note", 403);

  const noteAge = Date.now() - existing.createdAt.getTime();
  if (existing.wordCount < DELETE_PENALTY_MAX_WORDS && noteAge < DELETE_PENALTY_MAX_AGE_MS) {
    await prisma.$executeRaw`UPDATE "User" SET xp = GREATEST(0, xp - ${DELETE_PENALTY_XP}) WHERE id = ${user.userId}::uuid`;
    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        actionType: "delete_penalty",
        xpChange: -DELETE_PENALTY_XP,
        coinChange: 0,
        metadata: { noteId: params.id, wordCount: existing.wordCount, noteAge },
      },
    });
  }

  await prisma.note.update({
    where: { id: params.id },
    data: { isDeleted: true, deletedAt: new Date() },
    select: { id: true },
  });

  track({
    userId: user.userId,
    actionType: "note_delete",
    metadata: { noteId: params.id },
  });

  return success(null);
}
