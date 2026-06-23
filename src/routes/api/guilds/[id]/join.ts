import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { joinGuildSchema } from "~/validators/guild";
import { success, error } from "~/lib/api-response";
import { processAction } from "~/lib/gamification/engine";
import { getIO } from "~/lib/socket";
import { createNotification } from "~/lib/socket/notifications";
import { track } from "~/lib/analytics/tracker";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json().catch(() => ({}));
  const parsed = joinGuildSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  const guild = await prisma.guild.findUnique({
    where: { id: params.id },
    include: { _count: { select: { members: true } } },
  });
  if (!guild) return error("NOT_FOUND", "Guild not found", 404);

  if (!guild.isPublic) {
    if (!parsed.data.inviteCode || parsed.data.inviteCode !== guild.inviteCode) {
      return error("FORBIDDEN", "Invalid invite code", 403);
    }
  }

  const existingMember = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (existingMember) return error("CONFLICT", "Already a member", 409);

  if (guild._count.members >= guild.maxMembers) {
    return error("FORBIDDEN", "Guild is full", 403);
  }

  const memberRole = await prisma.guildRole.findUnique({
    where: { guildId_name: { guildId: params.id, name: "Member" } },
  });
  if (!memberRole) return error("INTERNAL_ERROR", "Guild roles not configured", 500);

  const member = await prisma.guildMember.create({
    data: {
      guildId: params.id,
      userId: user.userId,
      roleId: memberRole.id,
    },
  });

  await processAction({
    userId: user.userId,
    actionType: "join_guild",
    metadata: { guildId: params.id },
  });

  track({
    userId: user.userId,
    actionType: "guild_join",
    metadata: { guildId: params.id, guildName: guild.name, role: "member" },
  });

  createNotification(
    guild.ownerId,
    "guild_invite",
    `${user.username} joined ${guild.name}`,
    `A new member has joined your guild.`
  ).catch(() => {});

  try {
    const io = getIO();
    io.to(`guild:${params.id}`).emit("guild:user-joined", {
      userId: user.userId,
      username: user.username,
    });
  } catch {}

  return success(member);
}
