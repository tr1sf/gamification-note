import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { rateLimit } from "~/lib/rate-limit";
import { getIO } from "~/lib/socket";
import { getEquippedCosmetics } from "~/lib/cosmetics/equipped";

function mapMessage(m: {
  id: string;
  guildId: string;
  userId: string;
  content: string;
  createdAt: Date;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    inventory: Array<{
      isEquipped: boolean;
      item: {
        id: string;
        name: string;
        type: string;
        rarity: string;
        imageUrl: string | null;
        category: unknown;
      };
    }>;
  };
  reactions: Array<{
    emoji: string;
    userId: string;
    createdAt: Date | string;
  }>;
}) {
  return {
    id: m.id,
    guildId: m.guildId,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    userId: m.userId,
    user: {
      id: m.user.id,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
      equipped: getEquippedCosmetics(m.user.inventory),
    },
    reactions: (m.reactions || []).map((r) => ({
      emoji: r.emoji,
      userId: r.userId,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : r.createdAt.toISOString(),
    })),
  };
}

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member of this guild", 403);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const rawTake = parseInt(url.searchParams.get("take") || "50", 10);
  const take = Math.min(Math.max(Number.isNaN(rawTake) ? 50 : rawTake, 1), 100);

  const messages = await prisma.guildMessage.findMany({
    where: { guildId: params.id },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          inventory: {
            where: { isEquipped: true },
            select: {
              isEquipped: true,
              item: {
                select: { id: true, name: true, type: true, rarity: true, imageUrl: true, category: true },
              },
            },
          },
        },
      },
      reactions: { select: { emoji: true, userId: true, createdAt: true } },
    },
  });

  const hasMore = messages.length > take;
  if (hasMore) messages.pop();

  const reversed = messages.reverse();
  return success({
    items: reversed.map(mapMessage),
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
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          inventory: {
            where: { isEquipped: true },
            select: {
              isEquipped: true,
              item: {
                select: { id: true, name: true, type: true, rarity: true, imageUrl: true, category: true },
              },
            },
          },
        },
      },
      reactions: { select: { emoji: true, userId: true, createdAt: true } },
    },
  });

  const payload = mapMessage(message);

  try {
    const io = getIO();
    io.to(`guild:${params.id}`).emit("guild:message", payload);
  } catch {}

  return success(payload);
}
