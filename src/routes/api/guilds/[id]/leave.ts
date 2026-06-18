import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { getIO } from "~/lib/socket";
import { track } from "~/lib/analytics/tracker";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  try {
    await prisma.$transaction(async (tx) => {
      const membership = await tx.guildMember.findUnique({
        where: { guildId_userId: { guildId: params.id, userId: user.userId } },
      });
      if (!membership) throw new Error("NOT_MEMBER");

      const isOwner = membership.role === "owner";

      if (isOwner) {
        const otherMembers = await tx.guildMember.findMany({
          where: { guildId: params.id, userId: { not: user.userId } },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        });

        if (otherMembers.length === 0) {
          await tx.guild.delete({ where: { id: params.id } });
        } else {
          const newOwner = otherMembers[0];
          await tx.guild.update({
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

      await tx.guildMember.delete({ where: { id: membership.id } });
    });
  } catch (e: any) {
    if (e.message === "NOT_MEMBER") return success(null);
    throw e;
  }

  try {
    const io = getIO();
    io.to(`guild:${params.id}`).emit("guild:user-left", {
      userId: user.userId,
      username: user.username,
    });
  } catch {}

  track({
    userId: user.userId,
    actionType: "guild_leave",
    metadata: { guildId: params.id },
  });

  return success(null);
}
