import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const note = await prisma.note.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, isDeleted: true, title: true },
  });

  if (!note) return error("NOT_FOUND", "Note not found", 404);
  if (note.userId !== user.userId) return error("FORBIDDEN", "Not your note", 403);
  if (!note.isDeleted) return error("INVALID_STATE", "Note is not deleted", 400);

  // Only allow restore within 30 seconds of deletion
  const recent = await prisma.note.findFirst({
    where: {
      id: params.id,
      isDeleted: true,
      deletedAt: { gte: new Date(Date.now() - 30000) },
    },
  });
  if (!recent) return error("EXPIRED", "Restore window has passed", 400);

  await prisma.note.update({
    where: { id: params.id },
    data: { isDeleted: false, deletedAt: null },
  });

  return success({ id: params.id, title: note.title });
}
