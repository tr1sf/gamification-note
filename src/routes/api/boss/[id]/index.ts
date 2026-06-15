import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const boss = await prisma.challenge.findUnique({ where: { id: params.id } });
  if (!boss) return error("NOT_FOUND", "Boss not found", 404);

  const attacks = await prisma.auditLog.findMany({
    where: {
      userId: user.userId,
      actionType: "boss_damage",
      createdAt: { gte: boss.createdAt },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { metadata: true, createdAt: true, xpChange: true },
  });

  return success({ ...boss, attacks });
}
