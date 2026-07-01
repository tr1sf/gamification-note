import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { updateGuildSchema } from "~/validators/guild";
import { success, error } from "~/lib/api-response";
import { getIO } from "~/lib/socket";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);

  const guild = await prisma.guild.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { members: true } },
      owner: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  if (!guild) {
    return error("NOT_FOUND", "Guild not found", 404);
  }

  let membership: { role: string } | null = null;
  if (user) {
    membership = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: params.id, userId: user.userId } },
      select: { role: true },
    });
  }
  const isMember = !!membership;

  // Private guilds: non-members only see existence (404), not metadata.
  if (!guild.isPublic && !isMember) {
    return error("NOT_FOUND", "Guild not found", 404);
  }

  const canSeeInvite = membership?.role === "owner" || membership?.role === "admin";

  // Never expose the inviteCode to non-members (it bypasses the invite-only gate).
  const { inviteCode, ...safeGuild } = guild as typeof guild & { inviteCode: string | null };

  return success({
    ...safeGuild,
    ...(canSeeInvite ? { inviteCode } : {}),
    isMember,
  });
}

export async function PUT({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const parsed = updateGuildSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }
  if (!parsed.data.name && !parsed.data.description) {
    return error("VALIDATION_ERROR", "No fields to update", 400);
  }

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member", 403);
  if (membership.role !== "owner" && membership.role !== "admin") {
    return error("FORBIDDEN", "Only owners and admins can update the guild", 403);
  }

  const guild = await prisma.guild.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    },
  });

  try {
    const updatePayload: Record<string, unknown> = { id: params.id };
    if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
    if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description;
    getIO().to(`guild:${params.id}`).emit("guild:updated", updatePayload);
  } catch {}

  return success(guild);
}

export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const guild = await prisma.guild.findUnique({ where: { id: params.id } });
  if (!guild) return error("NOT_FOUND", "Guild not found", 404);
  if (guild.ownerId !== user.userId) {
    return error("FORBIDDEN", "Only the owner can delete the guild", 403);
  }

  await prisma.guild.delete({ where: { id: params.id } });

  return success(null);
}
