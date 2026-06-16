import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { role: true } });
  if (dbUser?.role !== "admin") return error("FORBIDDEN", "Admin only", 403);

  const surveys = await prisma.survey.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      surveyType: true,
      _count: { select: { responses: true } },
    },
  });

  const responses = await prisma.surveyResponse.findMany({
    where: { completedAt: { gte: new Date(Date.now() - 90 * 86400000) } },
    select: {
      surveyId: true,
      overallScore: true,
      completedAt: true,
    },
    orderBy: { completedAt: "asc" },
  });

  const scoresByDay: Record<string, { count: number; sum: number }> = {};
  for (const r of responses) {
    const key = r.completedAt.toISOString().slice(0, 10);
    if (!scoresByDay[key]) scoresByDay[key] = { count: 0, sum: 0 };
    scoresByDay[key].count++;
    if (r.overallScore != null) scoresByDay[key].sum += r.overallScore;
  }

  const trend = Object.entries(scoresByDay).map(([date, v]) => ({
    date,
    count: v.count,
    avgScore: v.count > 0 ? Math.round((v.sum / v.count) * 100) / 100 : null,
  }));

  return success({ surveys, responseTrend: trend });
}
