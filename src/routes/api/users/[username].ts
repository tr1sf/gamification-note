import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function GET({ params }: { request: Request; params: { username: string } }) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: { id: true, username: true, avatarUrl: true, level: true, title: true, createdAt: true },
  });
  if (!user) return error("NOT_FOUND", "User not found", 404);

  const notes = await prisma.note.findMany({
    where: { userId: user.id, isPublic: true, isDeleted: false },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true, title: true, content: true, category: true, tags: true,
      wordCount: true, updatedAt: true,
    },
  });

  return success({
    user,
    notes: notes.map((n) => ({
      ...n,
      excerpt: n.content.slice(0, 200),
      content: undefined,
    })),
  });
}
