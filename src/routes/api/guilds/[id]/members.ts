import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = (request as any).locals?.user;
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const guild = await prisma.guild.findUnique({ where: { id: params.id } });
  if (!guild) return error("NOT_FOUND", "Guild not found", 404);

  const members = await prisma.guildMember.findMany({
    where: { guildId: params.id },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
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
        },
      },
    },
  });

  return success(members.map((m) => ({
    id: m.id,
    role: m.role,
    joinedAt: m.joinedAt,
    userId: m.user.id,
    username: m.user.username,
    avatarUrl: m.user.avatarUrl,
    level: m.user.level,
  })));
}
