import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { role: true } });
  if (dbUser?.role !== "admin") return error("FORBIDDEN", "Admin only", 403);

  const signups = await prisma.user.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 90 * 86400000) } },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const cohorts: Array<{ date: string; signups: number; d3: number; d7: number; d30: number }> = [];
  const weekMap = new Map<string, string[]>();
  for (const u of signups) {
    const d = new Date(u.createdAt);
    d.setDate(d.getDate() - d.getDay());
    const key = d.toISOString().slice(0, 10);
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(u.id);
  }

  for (const [week, userIds] of weekMap) {
    const weekStart = new Date(week);
    const d3Date = new Date(weekStart.getTime() + 3 * 86400000);
    const d7Date = new Date(weekStart.getTime() + 7 * 86400000);
    const d30Date = new Date(weekStart.getTime() + 30 * 86400000);

    const [d3ActiveLogs, d7ActiveLogs, d30ActiveLogs] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId: { in: userIds }, actionType: "session_start", createdAt: { gte: d3Date, lt: new Date(d3Date.getTime() + 86400000) } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.auditLog.findMany({
        where: { userId: { in: userIds }, actionType: "session_start", createdAt: { gte: d7Date, lt: new Date(d7Date.getTime() + 86400000) } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.auditLog.findMany({
        where: { userId: { in: userIds }, actionType: "session_start", createdAt: { gte: d30Date, lt: new Date(d30Date.getTime() + 86400000) } },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

    cohorts.push({
      date: week,
      signups: userIds.length,
      d3: userIds.length > 0 ? Math.round((d3ActiveLogs.length / userIds.length) * 100) : 0,
      d7: userIds.length > 0 ? Math.round((d7ActiveLogs.length / userIds.length) * 100) : 0,
      d30: userIds.length > 0 ? Math.round((d30ActiveLogs.length / userIds.length) * 100) : 0,
    });
  }

  return success(cohorts);
}
