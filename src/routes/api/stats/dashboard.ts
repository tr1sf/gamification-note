import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

async function calculateStreak(userId: string): Promise<number> {
  const auditLogs = await prisma.auditLog.findMany({
    where: { userId, actionType: "daily_login" },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 365,
  });

  if (auditLogs.length === 0) return 0;

  const uniqueDates = new Set<string>();
  for (const log of auditLogs) {
    uniqueDates.add(log.createdAt.toISOString().slice(0, 10));
  }
  const dates = Array.from(uniqueDates).sort().reverse();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const current = new Date(dates[i - 1]);
    const prev = new Date(dates[i]);
    const diffDays = (current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (Math.abs(diffDays - 1) < 0.01) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function GET({ request }: { request: Request }) {
  const user = (request as any).locals?.user;
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const [totalNotes, wordsResult, questsCompleted, achievementsUnlocked, recentXP, streak] =
    await Promise.all([
      prisma.note.count({
        where: { userId: user.userId, isDeleted: false },
      }),
      prisma.note.aggregate({
        where: { userId: user.userId, isDeleted: false },
        _sum: { wordCount: true },
      }),
      prisma.userQuest.count({
        where: { userId: user.userId, status: { in: ["completed", "claimed"] } },
      }),
      prisma.userAchievement.count({
        where: { userId: user.userId, unlockedAt: { not: null } },
      }),
      prisma.auditLog.findMany({
        where: { userId: user.userId, xpChange: { gt: 0 } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { actionType: true, xpChange: true, createdAt: true },
      }),
      calculateStreak(user.userId),
    ]);

  return success({
    totalNotes,
    totalWords: wordsResult._sum.wordCount ?? 0,
    streak,
    questsCompleted,
    achievementsUnlocked,
    recentXP,
  });
}
