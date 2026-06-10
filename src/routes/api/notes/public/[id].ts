import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function GET({ params }: { request: Request; params: { id: string } }) {
  const note = await prisma.note.findUnique({
    where: { id: params.id, isDeleted: false, isPublic: true },
    select: {
      id: true, title: true, content: true, category: true, tags: true,
      isPublic: true, wordCount: true, version: true, aiSummary: true,
      aiImageUrl: true, createdAt: true, updatedAt: true,
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  if (!note) return error("NOT_FOUND", "Note not found or not public", 404);

  return success(note);
}
