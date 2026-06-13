import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return error("FORBIDDEN", "Only owner/admin can create goals", 403);
  }

  const body = await request.json();
  const { title, description, targetCount, startDate, endDate, rewardXp, rewardCoins } = body;
  if (!title || !targetCount || !endDate) {
    return error("VALIDATION_ERROR", "title, targetCount, endDate required", 400);
  }

  const goal = await prisma.guildGoal.create({
    data: {
      guildId: params.id,
      title,
      description: description || null,
      targetCount,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: new Date(endDate),
      rewardXp: rewardXp || 50,
      rewardCoins: rewardCoins || 15,
    },
  });

  return success(goal);
}

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const goals = await prisma.guildGoal.findMany({
    where: { guildId: params.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return success(goals);
}
