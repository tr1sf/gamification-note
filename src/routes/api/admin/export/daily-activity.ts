import { prisma } from "~/lib/db";
import { success } from "~/lib/api-response";

export async function GET() {
  const logs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    select: { actionType: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byDay: Record<string, Record<string, number>> = {};
  for (const log of logs) {
    const key = log.createdAt.toISOString().slice(0, 10);
    if (!byDay[key]) byDay[key] = {};
    byDay[key][log.actionType] = (byDay[key][log.actionType] || 0) + 1;
  }

  const activity = Object.entries(byDay).map(([date, counts]) => ({
    date,
    ...counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  }));

  const actionTypes = await prisma.auditLog.groupBy({
    by: ["actionType"],
    _count: { id: true },
    where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
  });

  const byType = actionTypes.map((a) => ({
    actionType: a.actionType,
    count: a._count.id,
  }));

  return success({ dailyActivity: activity, totals: byType });
}
