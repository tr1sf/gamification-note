import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = (request as any).locals?.user;
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const membership = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member", 403);
  if (membership.role !== "owner" && membership.role !== "admin") {
    return error("FORBIDDEN", "Only owners and admins can regenerate the invite code", 403);
  }

  let code = Math.random().toString(36).slice(2, 10);
  let attempts = 0;
  while (attempts < 5) {
    const existing = await prisma.guild.findUnique({ where: { inviteCode: code } });
    if (!existing) break;
    code = Math.random().toString(36).slice(2, 10);
    attempts++;
  }

  await prisma.guild.update({
    where: { id: params.id },
    data: { inviteCode: code },
  });

  return success({ inviteCode: code });
}
