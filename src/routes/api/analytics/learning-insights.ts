import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const notes = await prisma.note.findMany({
    where: { userId: user.userId, isDeleted: false },
    select: { createdAt: true, tags: true },
  });

  const dayCounts = new Map<number, number>();
  for (const n of notes) {
    dayCounts.set(n.createdAt.getDay(), (dayCounts.get(n.createdAt.getDay()) || 0) + 1);
  }
  let bestDay = 0;
  let bestDayCount = 0;
  for (const [day, count] of dayCounts) {
    if (count > bestDayCount) { bestDay = day; bestDayCount = count; }
  }
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const tagCounts = new Map<string, number>();
  for (const n of notes) {
    for (const t of n.tags) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  const totalQuizzes = await prisma.quiz.count({ where: { userId: user.userId } });
  const totalBossKills = await prisma.challenge.count({
    where: { userId: user.userId, bossType: { not: null }, status: "completed" },
  });

  return success({
    bestDay: days[bestDay],
    topTags,
    totalNotes: notes.length,
    totalQuizzes,
    totalBossKills,
  });
}
