import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";
import { getUserFromRequest } from "~/lib/auth/get-user";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const notes = await prisma.note.findMany({
    where: { userId: user.userId, isDeleted: false },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, title: true, content: true, category: true, tags: true,
      isPublic: true, wordCount: true, version: true, aiSummary: true,
      createdAt: true, updatedAt: true,
    },
  });

  return success(notes);
}
