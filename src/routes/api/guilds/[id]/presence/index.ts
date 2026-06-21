import { success, error } from "~/lib/api-response";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { prisma } from "~/lib/db";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const member = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!member) return error("FORBIDDEN", "Not a member", 403);

  // Presence is tracked via socket, return empty for now
  // Client will track via socket events
  return success({ onlineUserIds: [] });
}
