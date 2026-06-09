import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";
import { getUserFromRequest } from "~/lib/auth/get-user";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const take = Math.min(parseInt(url.searchParams.get("take") || "20"), 50);

  const notes = await prisma.note.findMany({
    where: { userId: user.userId, isDeleted: true },
    orderBy: { deletedAt: "desc" },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true, title: true, content: true, category: true, tags: true,
      isPublic: true, wordCount: true, version: true, deletedAt: true,
      createdAt: true, updatedAt: true,
    },
  });

  const hasMore = notes.length > take;
  if (hasMore) notes.pop();

  return success({
    items: notes.map((n) => ({
      ...n,
      excerpt: n.content.slice(0, 200),
      content: undefined,
    })),
    nextCursor: hasMore ? notes[notes.length - 1]?.id : null,
  });
}
