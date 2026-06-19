import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { rateLimit } from "~/lib/rate-limit";
import { getIO } from "~/lib/socket";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member of this guild", 403);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const take = Math.min(parseInt(url.searchParams.get("take") || "50"), 100);

  const messages = await prisma.guildMessage.findMany({
    where: { guildId: params.id },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
      reactions: true,
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  const hasMore = messages.length > take;
  if (hasMore) messages.pop();

  const reversed = messages.reverse();
  return success({
    items: reversed.map((m) => ({
      id: m.id,
      guildId: params.id,
      content: m.content,
      createdAt: m.createdAt,
      userId: m.userId,
      user: m.user,
      reactions: (m.reactions as unknown as Array<{ emoji: string; userId: string; createdAt: string }>) ?? [],
    })),
    nextCursor: hasMore ? reversed[0]?.id : null,
  });
}

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member of this guild", 403);

  const body = await request.json();
  const content = body.content as string;
  if (!content || typeof content !== "string" || content.length > 2000) {
    return error("VALIDATION_ERROR", "Message must be 1-2000 characters", 400);
  }

  if (!rateLimit(`guild_msg:${user.userId}`, 10, 10000)) {
    return error("RATE_LIMITED", "Too many messages", 429);
  }

  const message = await prisma.guildMessage.create({
    data: { guildId: params.id, userId: user.userId, content },
  });

  try {
    const io = getIO();
    io.to(`guild:${params.id}`).emit("guild:message", {
      id: message.id,
      guildId: params.id,
      userId: user.userId,
      user: { id: user.userId, username: user.username },
      content: message.content,
      reactions: [],
      createdAt: message.createdAt.toISOString(),
    });
  } catch {}

  return success({
    id: message.id,
    guildId: message.guildId,
    content: message.content,
    createdAt: message.createdAt,
    userId: message.userId,
    user: { id: user.userId, username: user.username },
    reactions: [],
  });
}
