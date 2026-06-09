import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";
import { getIO } from "~/lib/socket";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = (request as any).locals?.user;
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership) return error("NOT_FOUND", "Not a member", 404);

  const isOwner = membership.role === "owner";

  if (isOwner) {
    const otherMembers = await prisma.guildMember.findMany({
      where: { guildId: params.id, userId: { not: user.userId } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    if (otherMembers.length === 0) {
      await prisma.guild.delete({ where: { id: params.id } });
    } else {
      const newOwner = otherMembers[0];
      await prisma.guild.update({
        where: { id: params.id },
        data: {
          ownerId: newOwner.userId,
          members: {
            update: {
              where: { id: newOwner.id },
              data: { role: "owner" },
            },
          },
        },
      });
    }
  }

  await prisma.guildMember.delete({ where: { id: membership.id } });

  try {
    const io = getIO();
    io.to(`guild:${params.id}`).emit("guild:user-left", {
      userId: user.userId,
      username: user.username,
    });
  } catch {}

  return success(null);
}
