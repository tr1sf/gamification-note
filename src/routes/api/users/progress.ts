import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const period = (url.searchParams.get("period") || "week") as "week" | "month";

  const now = new Date();
  const periodStart = period === "week" ? startOfWeek(now) : startOfMonth(now);
  const prevStart = new Date(periodStart);
  if (period === "week") {
    prevStart.setDate(prevStart.getDate() - 7);
  } else {
    prevStart.setMonth(prevStart.getMonth() - 1);
  }

  const [
    currentNotes,
    prevNotes,
    currentWords,
    prevWords,
    currentReviews,
    prevReviews,
    allNotes,
    topTagsRaw,
    currentExports,
    questsCompleted,
    achievements,
  ] = await Promise.all([
    prisma.note.count({
      where: { userId: user.userId, isDeleted: false, createdAt: { gte: periodStart } },
    }),
    prisma.note.count({
      where: { userId: user.userId, isDeleted: false, createdAt: { gte: prevStart, lt: periodStart } },
    }),
    prisma.note.aggregate({
      where: { userId: user.userId, isDeleted: false, createdAt: { gte: periodStart } },
      _sum: { wordCount: true },
    }),
    prisma.note.aggregate({
      where: { userId: user.userId, isDeleted: false, createdAt: { gte: prevStart, lt: periodStart } },
      _sum: { wordCount: true },
    }),
    prisma.auditLog.count({
      where: { userId: user.userId, actionType: "note_review", createdAt: { gte: periodStart } },
    }),
    prisma.auditLog.count({
      where: { userId: user.userId, actionType: "note_review", createdAt: { gte: prevStart, lt: periodStart } },
    }),
    prisma.note.findMany({
      where: { userId: user.userId, isDeleted: false },
      select: { tags: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.$queryRaw<Array<{ tag: string; count: bigint }>>`
      SELECT unnest(tags) AS tag, COUNT(*) AS count
      FROM "Note"
      WHERE "userId" = ${user.userId}::uuid AND "isDeleted" = false AND tags IS NOT NULL
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 5
    `,
    prisma.auditLog.count({
      where: { userId: user.userId, actionType: "note_export", createdAt: { gte: periodStart } },
    }),
    prisma.userQuest.count({
      where: { userId: user.userId, status: { in: ["completed", "claimed"] }, completedAt: { gte: periodStart } },
    }),
    prisma.userAchievement.findMany({
      where: { userId: user.userId, unlockedAt: { gte: periodStart, not: null } },
      include: { achievement: { select: { title: true, icon: true } } },
      orderBy: { unlockedAt: "desc" },
      take: 5,
    }),
  ]);

  // Daily breakdown for the current period
  const dailyNotes: Array<{ date: string; count: number }> = [];
  const dayCounts = new Map<string, number>();
  for (const note of allNotes) {
    const key = note.createdAt.toISOString().slice(0, 10);
    if (new Date(key) >= periodStart) {
      dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
    }
  }
  for (const [date, count] of dayCounts) {
    dailyNotes.push({ date, count });
  }
  dailyNotes.sort((a, b) => a.date.localeCompare(b.date));

  // Best day of week
  const dayOfWeekCounts = new Map<number, number>();
  for (const note of allNotes) {
    const day = note.createdAt.getDay();
    dayOfWeekCounts.set(day, (dayOfWeekCounts.get(day) || 0) + 1);
  }
  let bestDayNum = 0;
  let bestDayCount = 0;
  for (const [day, count] of dayOfWeekCounts) {
    if (count > bestDayCount) { bestDayNum = day; bestDayCount = count; }
  }
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const currWords = currentWords._sum.wordCount ?? 0;
  const prevWordsVal = prevWords._sum.wordCount ?? 0;
  const currNotes = currentNotes;
  const prevNotesVal = prevNotes;

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return success({
    period,
    periodStart: periodStart.toISOString(),
    weekly: period === "week",
    monthly: period === "month",
    notes: currNotes,
    notesLast: prevNotesVal,
    notesChange: pctChange(currNotes, prevNotesVal),
    words: currWords,
    wordsLast: prevWordsVal,
    wordsChange: pctChange(currWords, prevWordsVal),
    reviews: currentReviews,
    reviewsLast: prevReviews,
    reviewsChange: pctChange(currentReviews, prevReviews),
    dailyNotes,
    bestDay: dayNames[bestDayNum],
    bestDayCount,
    topTags: topTagsRaw.map((t) => ({ tag: t.tag, count: Number(t.count) })),
    exports: currentExports,
    questsCompleted,
    achievements: achievements.map((a) => ({
      title: a.achievement.title,
      icon: a.achievement.icon,
      unlockedAt: a.unlockedAt!.toISOString(),
    })),
    totalNotes: allNotes.length,
  });
}
