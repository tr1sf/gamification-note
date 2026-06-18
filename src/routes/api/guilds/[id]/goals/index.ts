import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { grantReward } from "~/lib/gamification/engine";
import { createNotification } from "~/lib/socket/notifications";

// PATCH — increment goal progress (members only)
export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member", 403);

  const body = await request.json();
  const goalId = body.goalId as string;
  if (!goalId) return error("VALIDATION_ERROR", "goalId required", 400);

  const goal = await prisma.guildGoal.findUnique({ where: { id: goalId } });
  if (!goal || goal.guildId !== params.id) return error("NOT_FOUND", "Goal not found", 404);
  if (goal.isCompleted) return error("ALREADY_COMPLETED", "Goal already completed", 400);
  if (new Date() > goal.endDate) return error("EXPIRED", "This goal has ended", 400);

  let isComplete = false;
  let currentCount = 0;
  let memberIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Atomic increment — no read-modify-write race
    const updated = await tx.guildGoal.update({
      where: { id: goalId },
      data: { currentCount: { increment: 1 } },
    });
    currentCount = updated.currentCount;
    isComplete = currentCount >= goal.targetCount;

    if (isComplete) {
      await tx.guildGoal.update({ where: { id: goalId }, data: { isCompleted: true } });
      const members = await tx.guildMember.findMany({ where: { guildId: params.id }, select: { userId: true } });
      memberIds = members.map(m => m.userId);
      for (const m of members) {
        await grantReward({
          userId: m.userId,
          xp: goal.rewardXp,
          coins: goal.rewardCoins,
          actionType: "guild_goal_complete",
          metadata: { guildId: params.id, goalId, goalTitle: goal.title },
        });
      }
    }
  });

  // Notifications — reuse memberIds from transaction
  for (const userId of memberIds) {
    createNotification(userId, "guild_goal",
      isComplete ? `${goal.title} completed!` : `${goal.title}: ${currentCount}/${goal.targetCount}`,
      isComplete ? "Goal reached! Rewards granted." : `${user.username} contributed`).catch(() => {});
  }
  if (!isComplete && memberIds.length === 0) {
    createNotification(goal.guildId.endsWith("owner") ? params.id : membership.userId, "guild_goal",
      `${goal.title}: ${currentCount}/${goal.targetCount}`, `${user.username} contributed`).catch(() => {});
  }

  return success({ currentCount, isCompleted: isComplete, goalId });
}

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
