import { getUserFromRequest } from "~/lib/auth/get-user";
import { prisma } from "~/lib/db";
import { createNoteSchema } from "~/validators/note";
import { success, error } from "~/lib/api-response";
import { processAction } from "~/lib/gamification/engine";
import { computeWordCount, isBlockContent, parseBlocks, blockExcerpt } from "~/lib/blocks";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const takeParam = parseInt(url.searchParams.get("take") || "20", 10);
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 50) : 20;

  const notes = await prisma.note.findMany({
    where: { userId: user.userId, isDeleted: false },
    orderBy: { updatedAt: "desc" },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true, title: true, content: true, category: true, tags: true,
      isPublic: true, wordCount: true, version: true, aiSummary: true,
      createdAt: true, updatedAt: true,
    },
  });

  const hasMore = notes.length > take;
  if (hasMore) notes.pop();

  return success({
    items: notes.map((n) => ({
      ...n,
      excerpt: isBlockContent(n.content) ? blockExcerpt(parseBlocks(n.content)) : n.content.slice(0, 200),
      content: undefined,
    })),
    nextCursor: hasMore ? notes[notes.length - 1]?.id : null,
  });
}

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  const wordCount = computeWordCount(parsed.data.content);

  const note = await prisma.note.create({
    data: {
      ...parsed.data,
      userId: user.userId,
      wordCount,
      tags: parsed.data.tags || [],
    },
    select: { id: true, title: true, content: true, category: true, tags: true, isPublic: true, wordCount: true, version: true, createdAt: true, updatedAt: true },
  });

  const gamification = await processAction({
    userId: user.userId,
    actionType: "create_note",
    metadata: { noteId: note.id, wordCount: note.wordCount },
  });

  return success({ note, gamification });
}
