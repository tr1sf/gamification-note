import { getUserFromRequest } from "~/lib/auth/get-user";
import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function GET({ request, params }: { request: Request; params: { conversationId: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  // Verify user is member of this group
  const membership = await prisma.directMessageGroupMember.findUnique({
    where: { groupId_userId: { groupId: params.conversationId, userId: user.userId } },
  });
  if (!membership) return error("FORBIDDEN", "Not a member", 403);

  const messages = await prisma.directMessage.findMany({
    where: { groupId: params.conversationId },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return success(messages.reverse());
}