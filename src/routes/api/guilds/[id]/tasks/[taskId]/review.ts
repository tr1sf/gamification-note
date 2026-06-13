import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { reviewTaskSchema } from "~/validators/task";
import { grantReward, triggerActionNotifications } from "~/lib/gamification/engine";
import { createNotification } from "~/lib/socket/notifications";

// POST — owner/admin approves or rejects a submitted task.
//   approve → status "approved", grant the reward to the assignee.
//   reject  → status back to "assigned" with a review note so it can be redone.
export async function POST({ request, params }: { request: Request; params: { id: string; taskId: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const requester = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
    select: { role: true },
  });
  if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
    return error("FORBIDDEN", "Only owners and admins can review tasks", 403);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = reviewTaskSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  const task = await prisma.guildTask.findUnique({ where: { id: params.taskId } });
  if (!task || task.guildId !== params.id) return error("NOT_FOUND", "Task not found", 404);
  if (task.status === "approved") return error("CONFLICT", "Task already approved", 409);

  const guild = await prisma.guild.findUnique({ where: { id: params.id }, select: { name: true } });

  if (parsed.data.decision === "approve") {
    await prisma.guildTask.update({
      where: { id: params.taskId },
      data: { status: "approved", reviewedAt: new Date(), reviewNote: parsed.data.reviewNote ?? null },
    });

    if (task.xpReward > 0 || task.coinReward > 0) {
      const reward = await grantReward({
        userId: task.assigneeId,
        xp: task.xpReward,
        coins: task.coinReward,
        actionType: "guild_task_approved",
        metadata: { guildId: params.id, taskId: task.id },
      });
      triggerActionNotifications(task.assigneeId, reward);
    }

    createNotification(
      task.assigneeId,
      "guild_task",
      "Task approved! 🎉",
      `Your task "${task.title}" was approved${task.xpReward > 0 ? ` (+${task.xpReward} XP)` : ""}.`,
      { guildId: params.id, taskId: task.id }
    ).catch(() => {});

    return success({ status: "approved" });
  }

  // reject
  await prisma.guildTask.update({
    where: { id: params.taskId },
    data: { status: "assigned", reviewedAt: new Date(), submittedAt: null, reviewNote: parsed.data.reviewNote ?? null },
  });

  createNotification(
    task.assigneeId,
    "guild_task",
    "Task needs changes",
    `Your task "${task.title}" in ${guild?.name ?? "the guild"} was sent back${parsed.data.reviewNote ? `: ${parsed.data.reviewNote}` : "."}`,
    { guildId: params.id, taskId: task.id }
  ).catch(() => {});

  return success({ status: "assigned" });
}
