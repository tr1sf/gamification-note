import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { getIO } from "~/lib/socket";
import { createNotification } from "~/lib/socket/notifications";

type RouteCtx = { request: Request; params: { id: string; userId: string } };

// PATCH — change a member's role. Owner-only.
//   roleId: ID of the target GuildRole
//   If the target role is the "Owner" role, ownership is transferred.
export async function PATCH({ request, params }: RouteCtx) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json().catch(() => ({}));
  let roleId: string | undefined = body.roleId as string;

  if (!roleId && body.role) {
    const roleName = (body.role as string).charAt(0).toUpperCase() + (body.role as string).slice(1);
    const foundRole = await prisma.guildRole.findFirst({
      where: { guildId: params.id, name: roleName },
    });
    if (foundRole) roleId = foundRole.id;
  }

  if (!roleId) {
    return error("VALIDATION_ERROR", "roleId is required", 400);
  }

  const guild = await prisma.guild.findUnique({ where: { id: params.id } });
  if (!guild) return error("NOT_FOUND", "Guild not found", 404);
  if (guild.ownerId !== user.userId) {
    return error("FORBIDDEN", "Only the owner can change member roles", 403);
  }

  if (params.userId === user.userId) {
    return error("VALIDATION_ERROR", "You cannot change your own role", 400);
  }

  const target = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: params.userId } },
  });
  if (!target) return error("NOT_FOUND", "Member not found", 404);

  // Validate role exists and belongs to guild
  const targetRole = await prisma.guildRole.findFirst({
    where: { id: roleId, guildId: params.id },
  });
  if (!targetRole) return error("NOT_FOUND", "Role not found", 404);

  // Determine the legacy role string for backwards compatibility
  let legacyRole = "member";
  if (targetRole.name === "Owner") legacyRole = "owner";
  else if (targetRole.name === "Admin") legacyRole = "admin";
  // else keep "member"

  if (targetRole.name === "Owner") {
    // Transfer ownership: target becomes owner, old owner becomes admin.
    // Find the Admin role for this guild
    const adminRole = await prisma.guildRole.findFirst({
      where: { guildId: params.id, name: "Admin" },
    });
    // If no Admin role, fallback to using the legacy role string "admin"
    const adminRoleId = adminRole?.id;
    const adminLegacyRole = "admin";

    await prisma.$transaction([
      prisma.guild.update({ where: { id: params.id }, data: { ownerId: params.userId } }),
      prisma.guildMember.update({
        where: { guildId_userId: { guildId: params.id, userId: params.userId } },
        data: { roleId, role: legacyRole },
      }),
      prisma.guildMember.update({
        where: { guildId_userId: { guildId: params.id, userId: user.userId } },
        data: { roleId: adminRoleId ?? target.roleId, role: adminLegacyRole },
      }),
    ]);
    createNotification(
      params.userId,
      "guild_invite",
      `You are now the owner of ${guild.name}`,
      `${user.username} transferred guild ownership to you.`
    ).catch(() => {});
  } else {
    await prisma.guildMember.update({
      where: { guildId_userId: { guildId: params.id, userId: params.userId } },
      data: { roleId, role: legacyRole },
    });
    createNotification(
      params.userId,
      "guild_invite",
      legacyRole === "admin" ? `Promoted to admin in ${guild.name}` : `Role changed in ${guild.name}`,
      legacyRole === "admin"
        ? `${user.username} promoted you to admin.`
        : `${user.username} changed your role.`
    ).catch(() => {});
  }

  try {
    getIO().to(`guild:${params.id}`).emit("guild:role-changed", {
      userId: params.userId,
      roleId,
      role: legacyRole,
    });
  } catch {}

  return success({ userId: params.userId, roleId, role: legacyRole });
}

// DELETE — kick a member. Owner or admin.
export async function DELETE({ request, params }: RouteCtx) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const guild = await prisma.guild.findUnique({ where: { id: params.id } });
  if (!guild) return error("NOT_FOUND", "Guild not found", 404);

  const requester = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!requester) return error("FORBIDDEN", "Not a member", 403);
  if (requester.role !== "owner" && requester.role !== "admin") {
    return error("FORBIDDEN", "Only owners and admins can remove members", 403);
  }

  if (params.userId === user.userId) {
    return error("VALIDATION_ERROR", "Use leave to remove yourself", 400);
  }

  const target = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: params.userId } },
    include: { user: { select: { username: true } } },
  });
  if (!target) return error("NOT_FOUND", "Member not found", 404);

  if (target.role === "owner") {
    return error("FORBIDDEN", "The owner cannot be removed", 403);
  }
  if (requester.role === "admin" && target.role === "admin") {
    return error("FORBIDDEN", "Admins cannot remove other admins", 403);
  }

  await prisma.guildMember.delete({
    where: { guildId_userId: { guildId: params.id, userId: params.userId } },
  });

  createNotification(
    params.userId,
    "guild_invite",
    `Removed from ${guild.name}`,
    `You were removed from the guild by ${user.username}.`
  ).catch(() => {});

  try {
    getIO().to(`guild:${params.id}`).emit("guild:user-left", {
      userId: params.userId,
      username: target.user.username,
    });
  } catch {}

  return success(null);
}
