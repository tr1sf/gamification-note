import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const [totalNotes, wordsResult, userData, allTags, streakLogs, recentNotes] = await Promise.all([
    prisma.note.count({ where: { userId: user.userId, isDeleted: false } }),
    prisma.note.aggregate({ where: { userId: user.userId, isDeleted: false }, _sum: { wordCount: true } }),
    prisma.user.findUnique({ where: { id: user.userId }, select: { createdAt: true, streak: true } }),
    prisma.$queryRaw<Array<{ tag: string; count: bigint }>>`
      SELECT unnest(tags) AS tag, COUNT(*) AS count
      FROM "Note"
      WHERE "userId" = ${user.userId}::uuid AND "isDeleted" = false AND tags IS NOT NULL
      GROUP BY tag ORDER BY count DESC LIMIT 10
    `,
    prisma.auditLog.findMany({
      where: { userId: user.userId, actionType: "daily_login" },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 365,
    }),
    prisma.note.findMany({
      where: { userId: user.userId, isDeleted: false },
      select: { createdAt: true, wordCount: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalWords = wordsResult._sum.wordCount ?? 0;
  const avgWordsPerNote = totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0;
  const daysSinceJoined = userData ? Math.max(1, Math.ceil((Date.now() - userData.createdAt.getTime()) / 86400000)) : 1;
  const avgNotesPerDay = Math.round((totalNotes / daysSinceJoined) * 10) / 10;

  // Most productive day
  const dayCounts = new Map<number, number>();
  for (const note of recentNotes) {
    const day = note.createdAt.getDay();
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }
  let bestDayNum = 0; let bestDayCount = 0;
  for (const [day, count] of dayCounts) {
    if (count > bestDayCount) { bestDayNum = day; bestDayCount = count; }
  }
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Longest streak
  const dates = Array.from(new Set(streakLogs.map((l) => l.createdAt.toISOString().slice(0, 10)))).sort().reverse();
  let longestStreak = 0; let current = 0;
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) { current = 1; continue; }
    const diff = (new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime()) / 86400000;
    if (Math.abs(diff - 1) < 0.01) { current++; } else { longestStreak = Math.max(longestStreak, current); current = 1; }
  }
  longestStreak = Math.max(longestStreak, current);

  // Most reviewed note
  const reviewCounts = await prisma.auditLog.groupBy({
    by: ["metadata"],
    where: { userId: user.userId, actionType: "note_review" },
    _count: true,
    orderBy: { _count: { metadata: "desc" } },
    take: 1,
  });

  // Weekly activity comparison
  const now = new Date();
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay());
  const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const [thisWeekNotes, lastWeekNotes, thisWeekWords, lastWeekWords] = await Promise.all([
    prisma.note.count({ where: { userId: user.userId, isDeleted: false, createdAt: { gte: thisWeekStart } } }),
    prisma.note.count({ where: { userId: user.userId, isDeleted: false, createdAt: { gte: lastWeekStart, lt: thisWeekStart } } }),
    prisma.note.aggregate({ where: { userId: user.userId, isDeleted: false, createdAt: { gte: thisWeekStart } }, _sum: { wordCount: true } }),
    prisma.note.aggregate({ where: { userId: user.userId, isDeleted: false, createdAt: { gte: lastWeekStart, lt: thisWeekStart } }, _sum: { wordCount: true } }),
  ]);

  return success({
    totalNotes,
    totalWords,
    avgWordsPerNote,
    avgNotesPerDay,
    currentStreak: userData?.streak ?? 0,
    longestStreak,
    mostProductiveDay: dayNames[bestDayNum],
    topTags: allTags.map((t) => ({ tag: t.tag, count: Number(t.count) })),
    daysSinceJoined,
    thisWeek: {
      notes: thisWeekNotes,
      words: thisWeekWords._sum.wordCount ?? 0,
    },
    lastWeek: {
      notes: lastWeekNotes,
      words: lastWeekWords._sum.wordCount ?? 0,
    },
  });
}
