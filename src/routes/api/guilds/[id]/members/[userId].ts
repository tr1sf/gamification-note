import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { getIO } from "~/lib/socket";
import { createNotification } from "~/lib/socket/notifications";

type RouteCtx = { request: Request; params: { id: string; userId: string } };

// PATCH — change a member's role. Owner-only.
//   role: "admin" | "member"  → promote/demote
//   role: "owner"             → transfer ownership (demotes the current owner to admin)
export async function PATCH({ request, params }: RouteCtx) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json().catch(() => ({}));
  const role = body.role as string;
  if (!["owner", "admin", "member"].includes(role)) {
    return error("VALIDATION_ERROR", "role must be owner, admin, or member", 400);
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

  if (role === "owner") {
    // Transfer ownership: target becomes owner, old owner becomes admin.
    await prisma.$transaction([
      prisma.guild.update({ where: { id: params.id }, data: { ownerId: params.userId } }),
      prisma.guildMember.update({
        where: { guildId_userId: { guildId: params.id, userId: params.userId } },
        data: { role: "owner" },
      }),
      prisma.guildMember.update({
        where: { guildId_userId: { guildId: params.id, userId: user.userId } },
        data: { role: "admin" },
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
      data: { role },
    });
    createNotification(
      params.userId,
      "guild_invite",
      role === "admin" ? `Promoted to admin in ${guild.name}` : `Role changed in ${guild.name}`,
      role === "admin"
        ? `${user.username} promoted you to admin.`
        : `${user.username} set your role to member.`
    ).catch(() => {});
  }

  try {
    getIO().to(`guild:${params.id}`).emit("guild:role-changed", {
      userId: params.userId,
      role,
    });
  } catch {}

  return success({ userId: params.userId, role });
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
    select: { role: true },
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
      username: "",
    });
  } catch {}

  return success(null);
}
