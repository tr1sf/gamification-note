import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { isBlockContent, parseBlocks, blockExcerpt } from "~/lib/blocks";
import { processAction } from "~/lib/gamification/engine";

type RouteCtx = { request: Request; params: { id: string } };

async function requireMembership(guildId: string, userId: string) {
  return prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId, userId } },
    select: { role: true },
  });
}

// GET — list scrolls shared with this guild (members only).
export async function GET({ request, params }: RouteCtx) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await requireMembership(params.id, user.userId);
  if (!membership) return error("FORBIDDEN", "Not a member of this guild", 403);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const take = Math.min(parseInt(url.searchParams.get("take") || "20"), 50);

  const notes = await prisma.note.findMany({
    where: { guildId: params.id, isDeleted: false },
    orderBy: { updatedAt: "desc" },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true, title: true, content: true, category: true, tags: true,
      wordCount: true, isPublic: true, updatedAt: true, userId: true,
      user: { select: { id: true, username: true } },
    },
  });

  const hasMore = notes.length > take;
  if (hasMore) notes.pop();

  return success({
    items: notes.map((n) => ({
      id: n.id,
      title: n.title,
      excerpt: isBlockContent(n.content) ? blockExcerpt(parseBlocks(n.content)) : n.content.slice(0, 200),
      category: n.category,
      tags: n.tags,
      wordCount: n.wordCount,
      isPublic: n.isPublic,
      updatedAt: n.updatedAt,
      author: n.user,
    })),
    nextCursor: hasMore ? notes[notes.length - 1]?.id : null,
  });
}

// POST — share one of your own scrolls into the guild. body: { noteId }
export async function POST({ request, params }: RouteCtx) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await requireMembership(params.id, user.userId);
  if (!membership) return error("FORBIDDEN", "Not a member of this guild", 403);

  const body = await request.json().catch(() => ({}));
  const noteId = body.noteId as string;
  if (!noteId || typeof noteId !== "string") {
    return error("VALIDATION_ERROR", "noteId is required", 400);
  }

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, userId: true, isDeleted: true, guildId: true },
  });
  if (!note || note.isDeleted) return error("NOT_FOUND", "Scroll not found", 404);
  if (note.userId !== user.userId) {
    return error("FORBIDDEN", "You can only share your own scrolls", 403);
  }
  if (note.guildId === params.id) {
    return error("CONFLICT", "This scroll is already shared with the guild", 409);
  }

  await prisma.note.update({
    where: { id: noteId },
    data: { guildId: params.id },
  });

  await processAction({
    userId: user.userId,
    actionType: "share_note",
    metadata: { noteId, guildId: params.id },
  }).catch(() => {});

  return success({ noteId, guildId: params.id });
}
