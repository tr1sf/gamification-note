import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const guild = await prisma.guild.findUnique({ where: { id: params.id } });
  if (!guild) return error("NOT_FOUND", "Guild not found", 404);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const take = Math.min(parseInt(url.searchParams.get("take") || "50"), 100);

  const members = await prisma.guildMember.findMany({
    where: { guildId: params.id },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      role: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          level: true,
          title: true,
        },
      },
    },
  });

  const hasMore = members.length > take;
  if (hasMore) members.pop();

  // Shape matches the GuildMember type / MemberList component: nested `user`.
  return success({
    items: members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      guildId: params.id,
      userId: m.user.id,
      user: {
        id: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        level: m.user.level,
        title: m.user.title,
      },
    })),
    nextCursor: hasMore ? members[members.length - 1]?.id : null,
  });
}
