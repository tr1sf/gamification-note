import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { rateLimit } from "~/lib/rate-limit";
import { getIO } from "~/lib/socket";

interface Reaction {
  emoji: string;
  userId: string;
  createdAt: string;
}

export async function POST({ request, params }: { request: Request; params: { id: string; messageId: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  // Rate limit
  if (!rateLimit(`guild_react:${user.userId}`, 20, 10000)) {
    return error("RATE_LIMITED", "Too many reactions", 429);
  }

  // Check guild membership
  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member of this guild", 403);

  const body = await request.json();
  const emoji = body.emoji as string;
  if (!emoji || typeof emoji !== "string" || emoji.length > 10) {
    return error("VALIDATION_ERROR", "Valid emoji required", 400);
  }

  // Atomic read-modify-write in transaction
  let result: Reaction[];
  try {
    result = await prisma.$transaction(async (tx) => {
      const message = await tx.guildMessage.findUnique({ where: { id: params.messageId } });
      if (!message || message.guildId !== params.id) throw new Error("NOT_FOUND");

      const reactions: Reaction[] = (message.reactions as unknown as Reaction[]) || [];
      const filtered = reactions.filter((r) => r.userId !== user.userId);
      const existing = reactions.find((r) => r.userId === user.userId);
      if (!existing || existing.emoji !== emoji) {
        filtered.push({ emoji, userId: user.userId, createdAt: new Date().toISOString() });
      }

      await tx.guildMessage.update({
        where: { id: params.messageId },
        data: { reactions: filtered as any },
      });

      return filtered;
    });
  } catch (e: any) {
    if (e?.message === "NOT_FOUND") {
      return error("NOT_FOUND", "Message not found", 404);
    }
    throw e;
  }

  // Socket broadcast
  try {
    getIO().to(`guild:${params.id}`).emit("guild:message-reaction", {
      messageId: params.messageId,
      reactions: result,
    });
  } catch {}

  return success({ reactions: result });
}

export async function DELETE({ request, params }: { request: Request; params: { id: string; messageId: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member of this guild", 403);

  let result: Reaction[];
  try {
    result = await prisma.$transaction(async (tx) => {
      const message = await tx.guildMessage.findUnique({ where: { id: params.messageId } });
      if (!message || message.guildId !== params.id) throw new Error("NOT_FOUND");

      const reactions: Reaction[] = (message.reactions as unknown as Reaction[]) || [];
      const filtered = reactions.filter((r) => r.userId !== user.userId);

      await tx.guildMessage.update({
        where: { id: params.messageId },
        data: { reactions: filtered as any },
      });

      return filtered;
    });
  } catch (e: any) {
    if (e?.message === "NOT_FOUND") {
      return error("NOT_FOUND", "Message not found", 404);
    }
    throw e;
  }

  try {
    getIO().to(`guild:${params.id}`).emit("guild:message-reaction", {
      messageId: params.messageId,
      reactions: result,
    });
  } catch {}

  return success({ reactions: result });
}
