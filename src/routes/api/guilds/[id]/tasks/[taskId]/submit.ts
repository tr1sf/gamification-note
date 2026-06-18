import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { createNotification } from "~/lib/socket/notifications";

// POST — the assignee marks the task as done, sending it for review.
export async function POST({ request, params }: { request: Request; params: { id: string; taskId: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const task = await prisma.guildTask.findUnique({ where: { id: params.taskId } });
  if (!task || task.guildId !== params.id) return error("NOT_FOUND", "Task not found", 404);
  if (task.status !== "assigned") {
    return error("CONFLICT", "Task is not in assignable state", 409);
  }
  if (task.assigneeId !== user.userId) {
    return error("FORBIDDEN", "Only the assignee can submit this task", 403);
  }

  await prisma.guildTask.update({
    where: { id: params.taskId },
    data: { status: "submitted", submittedAt: new Date(), reviewNote: null },
  });

  createNotification(
    task.creatorId,
    "guild_task",
    "Task submitted for review",
    `${user.username} submitted: ${task.title}`,
    { guildId: params.id, taskId: task.id }
  ).catch(() => {});

  return success({ status: "submitted" });
}
