import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 86400000);

  const counts = await prisma.auditLog.groupBy({
    by: ["actionType"],
    where: { userId: user.userId, createdAt: { gte: since } },
    _count: true,
  });

  const total = counts.reduce((s, c) => s + c._count, 0) || 1;
  const result: Record<string, number> = {};
  for (const c of counts) result[c.actionType] = Math.round((c._count / total) * 100);

  return success(result);
}
