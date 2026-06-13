import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

// DELETE — remove a task. Allowed for the task creator or the guild owner.
export async function DELETE({ request, params }: { request: Request; params: { id: string; taskId: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const task = await prisma.guildTask.findUnique({ where: { id: params.taskId } });
  if (!task || task.guildId !== params.id) return error("NOT_FOUND", "Task not found", 404);

  const guild = await prisma.guild.findUnique({ where: { id: params.id }, select: { ownerId: true } });
  const isCreator = task.creatorId === user.userId;
  const isOwner = guild?.ownerId === user.userId;
  if (!isCreator && !isOwner) {
    return error("FORBIDDEN", "Only the task creator or guild owner can delete this task", 403);
  }

  await prisma.guildTask.delete({ where: { id: params.taskId } });
  return success(null);
}
