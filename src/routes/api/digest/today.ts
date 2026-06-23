import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Yesterday's stats
  const [yesterdayNotes, yesterdayXp, yesterdayWords] = await Promise.all([
    prisma.note.count({
      where: { userId: user.userId, createdAt: { gte: yesterday, lt: today }, isDeleted: false },
    }),
    prisma.auditLog.aggregate({
      where: { userId: user.userId, createdAt: { gte: yesterday, lt: today }, actionType: { notIn: ["delete_penalty"] } },
      _sum: { xpChange: true },
    }),
    prisma.note.aggregate({
      where: { userId: user.userId, createdAt: { gte: yesterday, lt: today }, isDeleted: false },
      _sum: { wordCount: true },
    }),
  ]);

  // Active bosses
  const activeBosses = await prisma.challenge.findMany({
    where: { userId: user.userId, bossType: { in: ["daily", "weekly"] }, status: "active" },
    select: { id: true, bossName: true, bossEmoji: true, bossCurrentHp: true, bossMaxHp: true, bossType: true },
  });

  // Today's quests
  const quests = await prisma.quest.findMany({
    where: { questType: { in: ["daily", "chain", "weekly"] } },
    select: { id: true, title: true, questType: true, icon: true, xpReward: true, coinReward: true },
    orderBy: { title: "asc" },
    take: 5,
  });

  // Incomplete habits
  const habits = await prisma.habit.findMany({
    where: { userId: user.userId, isArchived: false },
    select: { id: true, title: true, icon: true, streak: true, lastCompletedOn: true },
    orderBy: { lastCompletedOn: { sort: "asc", nulls: "first" } },
  });

  // Streak info
  const userData = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { streak: true },
  });

  return success({
    yesterday: {
      notesWritten: yesterdayNotes,
      xpEarned: yesterdayXp._sum.xpChange ?? 0,
      wordsWritten: yesterdayWords._sum.wordCount ?? 0,
    },
    today: {
      activeBosses,
      suggestedQuests: quests,
      habits: habits.map((h) => ({
        ...h,
        completedToday: !!(h.lastCompletedOn && new Date(h.lastCompletedOn).toDateString() === today.toDateString()),
      })),
    },
    streak: userData?.streak ?? 0,
  });
}
