import { prisma } from "~/lib/db";
import { updateNoteSchema } from "~/validators/note";
import { success, error } from "~/lib/api-response";
import { processAction } from "~/lib/gamification/engine";
import { getUserFromRequest } from "~/lib/auth/get-user";

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
    select: { id: true, isDeleted: true, userId: true, version: true, isPublic: true },
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
    updateData.wordCount = updateData.content.split(/\s+/).filter(Boolean).length;
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

  let gamification = null;
  if (isBecomingPublic) {
    gamification = await processAction({
      userId: user.userId,
      actionType: "make_public",
      metadata: { noteId: note.id },
    });
  }

  return success({ note, gamification });
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const existing = await prisma.note.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!existing) return error("NOT_FOUND", "Note not found", 404);
  if (existing.userId !== user.userId) return error("FORBIDDEN", "Not your note", 403);

  await prisma.note.update({
    where: { id: params.id },
    data: { isDeleted: true, deletedAt: new Date() },
    select: { id: true },
  });

  return success(null);
}
