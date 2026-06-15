import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "7");
  const since = new Date(Date.now() - days * 86400000);

  const [notes, quizzes, quizAttempts, bossDamage, streak] = await Promise.all([
    prisma.note.count({ where: { userId: user.userId, isDeleted: false, createdAt: { gte: since } } }),
    prisma.quiz.count({ where: { userId: user.userId } }),
    prisma.quizAttempt.count({ where: { userId: user.userId, completedAt: { gte: since } } }),
    prisma.auditLog.count({ where: { userId: user.userId, actionType: "boss_damage", createdAt: { gte: since } } }),
    prisma.user.findUnique({ where: { id: user.userId }, select: { streak: true } }),
  ]);

  const auditLogs = await prisma.auditLog.findMany({
    where: { userId: user.userId, createdAt: { gte: since } },
    select: { createdAt: true, actionType: true },
  });

  const dayMap = new Map<string, { notes: number; quizzes: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000);
    dayMap.set(d.toISOString().slice(0, 10), { notes: 0, quizzes: 0 });
  }
  for (const log of auditLogs) {
    const key = log.createdAt.toISOString().slice(0, 10);
    const entry = dayMap.get(key) || { notes: 0, quizzes: 0 };
    if (log.actionType === "create_note") entry.notes++;
    if (log.actionType === "quiz") entry.quizzes++;
    dayMap.set(key, entry);
  }

  const dailyActivity = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, notes: counts.notes, quizzes: counts.quizzes }));

  return success({
    notes,
    quizzes,
    quizAttempts,
    bossAttacks: bossDamage,
    streak: streak?.streak || 0,
    dailyActivity,
  });
}
