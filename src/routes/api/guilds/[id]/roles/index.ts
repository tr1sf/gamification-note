import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

// GET — list all roles for a guild (members only)
export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const member = await prisma.guildMember.findUnique({
    where: { guildId_userId: { guildId: params.id, userId: user.userId } },
  });
  if (!member) return error("FORBIDDEN", "Not a member", 403);

  const roles = await prisma.guildRole.findMany({
    where: { guildId: params.id },
    orderBy: { position: "desc" },
  });

  return success(roles);
}
