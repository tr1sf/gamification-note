import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";
import { getUserFromRequest } from "~/lib/auth/get-user";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const original = await prisma.note.findUnique({
    where: { id: params.id, isDeleted: false },
    select: { id: true, title: true, content: true, category: true, tags: true, isPublic: true, userId: true },
  });
  if (!original) return error("NOT_FOUND", "Note not found", 404);
  if (original.userId !== user.userId && !original.isPublic) return error("FORBIDDEN", "Access denied", 403);

  const wordCount = original.content.split(/\s+/).filter(Boolean).length;

  const duplicate = await prisma.note.create({
    data: {
      title: `${original.title} (copy)`,
      content: original.content,
      category: original.category,
      tags: original.tags,
      isPublic: false,
      userId: user.userId,
      wordCount,
    },
    select: { id: true, title: true, content: true, category: true, tags: true, isPublic: true, wordCount: true, version: true, createdAt: true, updatedAt: true },
  });

  return success(duplicate);
}
