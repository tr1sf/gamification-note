import { getUserFromRequest } from "~/lib/auth/get-user";
import { prisma } from "~/lib/db";
import { createNoteSchema } from "~/validators/note";
import { success, error } from "~/lib/api-response";
import { processAction } from "~/lib/gamification/engine";
import { computeWordCount, isBlockContent, parseBlocks, blockExcerpt } from "~/lib/blocks";
import { track } from "~/lib/analytics/tracker";
import { calculateStructureScore, scorePlainText } from "~/lib/analytics/quality-scorer";
import { DUPLICATE_SIMILARITY_THRESHOLD } from "~/lib/gamification/constants";
import { generateQuiz } from "~/lib/quiz/generator";

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

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
}
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
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

  const contentTokens = tokenize(parsed.data.content);
  const recentNotes = await prisma.note.findMany({
    where: { userId: user.userId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { content: true },
  });
  const isDuplicate = recentNotes.some((n) => jaccardSimilarity(contentTokens, tokenize(n.content)) >= DUPLICATE_SIMILARITY_THRESHOLD);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dailyNoteCount = await prisma.auditLog.count({
    where: { userId: user.userId, actionType: "create_note", createdAt: { gte: todayStart } },
  });

  const isBlock = isBlockContent(parsed.data.content);
  let structureScore: number | undefined;
  if (isBlock) {
    const blocks = parseBlocks(parsed.data.content);
    const { score } = calculateStructureScore(blocks, parsed.data.tags ?? [], parsed.data.category ?? null);
    structureScore = score;
  } else {
    const { score } = scorePlainText(parsed.data.content, parsed.data.tags ?? [], parsed.data.category ?? null);
    structureScore = score;
  }

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
    metadata: { noteId: note.id, wordCount: note.wordCount, structureScore, dailyNoteCount, isSpam: isDuplicate },
  });

  // Reflection depth bonus (journaler path)
  if (note.wordCount >= 200) {
    const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { path: true } });
    if (u?.path === "journaler") {
      const { grantReward } = await import("~/lib/gamification/engine");
      const { REFLECTION_XP_BONUS, REFLECTION_COIN_BONUS } = await import("~/lib/gamification/constants");
      grantReward({
        userId: user.userId,
        xp: REFLECTION_XP_BONUS,
        coins: REFLECTION_COIN_BONUS,
        actionType: "deep_reflection",
        metadata: { noteId: note.id, wordCount: note.wordCount },
      }).catch(e => console.error("[reflection bonus]", e));
    }
  }

  let qualityMeta: Record<string, unknown> = {};
  if (isBlock) {
    const blocks = parseBlocks(note.content);
    const { metadata } = calculateStructureScore(blocks, note.tags, note.category);
    qualityMeta = metadata as Record<string, unknown>;
  } else {
    const { metadata } = scorePlainText(note.content, note.tags, note.category);
    qualityMeta = metadata as Record<string, unknown>;
  }

  track({
    userId: user.userId,
    actionType: "note_create",
    metadata: { noteId: note.id, noteTitle: note.title, wordCount: note.wordCount, ...qualityMeta },
  });

  track({
    userId: user.userId,
    actionType: "note_quality_score",
    metadata: { noteId: note.id, noteTitle: note.title, ...qualityMeta },
  });

  if (note.wordCount >= 100) {
    generateQuiz(note.content, note.wordCount)
      .then(async (questions) => {
        await prisma.quiz.upsert({
          where: { noteId: note.id },
          create: { noteId: note.id, userId: user.userId, questions: questions as any },
          update: {},
        });
        const { createNotification } = await import("~/lib/socket/notifications");
        createNotification(user.userId, "quiz_generated", "Quiz Ready!", "Your note has been turned into a quiz. Review it to test your knowledge!", { metadata: { noteId: note.id } }).catch(() => {});
      })
      .catch(e => console.error("[quiz] auto-generation failed:", e?.message || e));
  }

  // Apply boss damage
  const activeBoss = await prisma.challenge.findFirst({
    where: { userId: user.userId, bossType: { in: ["daily", "weekly"] }, status: "active" },
  });
  if (activeBoss) {
    const dmg = 5 * Math.max(1, (structureScore || 5) / 5);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE "Challenge" SET "bossCurrentHp" = GREATEST(0, "bossCurrentHp" - ${dmg}) WHERE id = ${activeBoss.id}::uuid`;
        const updated = await tx.challenge.findUnique({ where: { id: activeBoss.id }, select: { bossCurrentHp: true } });
        if (updated && (updated.bossCurrentHp ?? 0) <= 0) {
          await tx.challenge.update({ where: { id: activeBoss.id }, data: { status: "completed", completedAt: new Date() } });
        }
        await tx.auditLog.create({
          data: {
            userId: user.userId,
            actionType: "boss_damage",
            xpChange: 0,
            coinChange: 0,
            metadata: { bossId: activeBoss.id, damage: dmg, source: "note", bossName: activeBoss.bossName },
          },
        });
      });
    } catch (e) { console.error("[boss] auto-damage failed:", e); }
  }

  // Auto-increment guild goal progress for all guilds the user belongs to
  const memberships = await prisma.guildMember.findMany({
    where: { userId: user.userId },
    select: { guildId: true },
  });
  for (const m of memberships) {
    await prisma.guildGoal.updateMany({
      where: { guildId: m.guildId, isCompleted: false },
      data: { currentCount: { increment: 1 } },
    });
  }

  return success({ note, gamification });
}
