import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const days = 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const logs = await prisma.auditLog.findMany({
    where: {
      userId: user.userId,
      createdAt: { gte: startDate },
      actionType: { in: ["create_note", "daily_login", "note_review", "ai_summarize", "note_edit"] },
    },
    select: { actionType: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Aggregate by date
  const heatmap = new Map<string, { date: string; count: number; types: Record<string, number> }>();
  for (const log of logs) {
    const key = log.createdAt.toISOString().slice(0, 10);
    if (!heatmap.has(key)) {
      heatmap.set(key, { date: key, count: 0, types: {} });
    }
    const entry = heatmap.get(key)!;
    entry.count++;
    entry.types[log.actionType] = (entry.types[log.actionType] || 0) + 1;
  }

  const data = Array.from(heatmap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Max count for intensity scaling
  const maxCount = data.reduce((max, d) => Math.max(max, d.count), 0);

  return success({ days, data, maxCount });
}
