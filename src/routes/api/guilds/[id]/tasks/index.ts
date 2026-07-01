import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { createTaskSchema } from "~/validators/task";
import { createNotification } from "~/lib/socket/notifications";

type RouteCtx = { request: Request; params: { id: string } };

const userSelect = { select: { id: true, username: true, avatarUrl: true } };

function serialize(t: any) {
  return {
    id: t.id,
    guildId: t.guildId,
    title: t.title,
    description: t.description,
    xpReward: t.xpReward,
    coinReward: t.coinReward,
    dueAt: t.dueAt,
    status: t.status,
    submittedAt: t.submittedAt,
    reviewedAt: t.reviewedAt,
    reviewNote: t.reviewNote,
    createdAt: t.createdAt,
    creator: t.creator,
    assignee: t.assignee,
  };
}

// GET — list all tasks in the guild (any member can view).
export async function GET({ request, params }: RouteCtx) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
    select: { role: true },
  });
  if (!membership) return error("FORBIDDEN", "Not a member of this guild", 403);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const assigneeId = url.searchParams.get("assigneeId");

  const tasks = await prisma.guildTask.findMany({
    where: {
      guildId: params.id,
      ...(status ? { status } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { creator: userSelect, assignee: userSelect },
  });

  return success({ items: tasks.map(serialize) });
}

// POST — create & assign a task (owner/admin only).
export async function POST({ request, params }: RouteCtx) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const requester = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
    select: { role: true },
  });
  if (!requester) return error("FORBIDDEN", "Not a member", 403);
  if (requester.role !== "owner" && requester.role !== "admin") {
    return error("FORBIDDEN", "Only owners and admins can assign tasks", 403);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  // Assignee must be a member of this guild.
  const assignee = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: parsed.data.assigneeId } },
    select: { userId: true },
  });
  if (!assignee) return error("VALIDATION_ERROR", "Assignee is not a member of this guild", 400);

  const guild = await prisma.guild.findUnique({ where: { id: params.id }, select: { name: true } });

  const task = await prisma.guildTask.create({
    data: {
      guildId: params.id,
      creatorId: user.userId,
      assigneeId: parsed.data.assigneeId,
      title: parsed.data.title,
      description: parsed.data.description,
      xpReward: Math.min(Math.max(parsed.data.xpReward ?? 0, 0), 50),
      coinReward: Math.min(Math.max(parsed.data.coinReward ?? 0, 0), 20),
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
    },
    include: { creator: userSelect, assignee: userSelect },
  });

  createNotification(
    parsed.data.assigneeId,
    "guild_task",
    `New task in ${guild?.name ?? "your guild"}`,
    `${user.username} assigned you: ${task.title}`,
    { guildId: params.id, taskId: task.id }
  ).catch(() => {});

  return success(serialize(task));
}
