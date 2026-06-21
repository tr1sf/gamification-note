import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { rateLimit } from "~/lib/rate-limit";
import { getIO } from "~/lib/socket";

async function fetchReactions(messageId: string) {
  return prisma.guildMessageReaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function POST({ request, params }: { request: Request; params: { id: string; messageId: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  if (!rateLimit(`guild_react:${user.userId}`, 20, 10000)) {
    return error("RATE_LIMITED", "Too many reactions", 429);
  }

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member of this guild", 403);

  const body = await request.json();
  const emoji = body.emoji as string;
  if (!emoji || typeof emoji !== "string" || emoji.length > 10) {
    return error("VALIDATION_ERROR", "Valid emoji required", 400);
  }

  // Verify message exists in this guild
  const message = await prisma.guildMessage.findUnique({
    where: { id: params.messageId },
    select: { id: true, guildId: true },
  });
  if (!message || message.guildId !== params.id) {
    return error("NOT_FOUND", "Message not found", 404);
  }

  // Toggle: remove any existing reaction by this user, then add the new one.
  await prisma.$transaction([
    prisma.guildMessageReaction.deleteMany({
      where: { messageId: params.messageId, userId: user.userId },
    }),
    prisma.guildMessageReaction.create({
      data: { messageId: params.messageId, userId: user.userId, emoji },
    }),
  ]);

  const reactions = await fetchReactions(params.messageId);

  const formatted = reactions.map((r) => ({
    emoji: r.emoji,
    userId: r.userId,
    createdAt: r.createdAt.toISOString(),
  }));

  try {
    getIO().to(`guild:${params.id}`).emit("guild:message-reaction", {
      messageId: params.messageId,
      reactions: formatted,
    });
  } catch {}

  return success({ reactions: formatted });
}

export async function DELETE({ request, params }: { request: Request; params: { id: string; messageId: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member of this guild", 403);

  const message = await prisma.guildMessage.findUnique({
    where: { id: params.messageId },
    select: { id: true, guildId: true },
  });
  if (!message || message.guildId !== params.id) {
    return error("NOT_FOUND", "Message not found", 404);
  }

  await prisma.guildMessageReaction.deleteMany({
    where: { messageId: params.messageId, userId: user.userId },
  });

  const reactions = await fetchReactions(params.messageId);
  const formatted = reactions.map((r) => ({
    emoji: r.emoji,
    userId: r.userId,
    createdAt: r.createdAt.toISOString(),
  }));

  try {
    getIO().to(`guild:${params.id}`).emit("guild:message-reaction", {
      messageId: params.messageId,
      reactions: formatted,
    });
  } catch {}

  return success({ reactions: formatted });
}
