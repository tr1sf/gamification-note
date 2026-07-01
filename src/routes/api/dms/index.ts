import { getUserFromRequest } from "~/lib/auth/get-user";
import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  // Get 1:1 conversations (groups where user is a member)
  const groupMemberships = await prisma.directMessageGroupMember.findMany({
    where: { userId: user.userId },
    include: {
      group: {
        include: {
          members: {
            include: { user: { select: { id: true, username: true, avatarUrl: true } } },
          },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  return success(
    groupMemberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      type: m.group.members.length === 2 ? "direct" : "group",
      members: m.group.members.map((mem) => mem.user),
      lastMessage: m.group.messages[0] || null,
    }))
  );
}

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const { receiverId, groupId, content } = await request.json();

  if (!content || content.length > 2000) {
    return error("VALIDATION_ERROR", "Invalid content", 400);
  }

  let targetGroupId = groupId;

  // If 1:1 DM, find or create group
  if (!targetGroupId && receiverId) {
    const userGroups = await prisma.directMessageGroupMember.findMany({
      where: { userId: user.userId },
      include: { group: { include: { members: { select: { userId: true } } } } },
    });

    const existingGroup = userGroups.find(
      (ug) =>
        ug.group.members.length === 2 &&
        ug.group.members.some((m) => m.userId === receiverId)
    );

    if (existingGroup) {
      targetGroupId = existingGroup.group.id;
    } else {
      const group = await prisma.directMessageGroup.create({
        data: {
          members: {
            create: [{ userId: user.userId }, { userId: receiverId }],
          },
        },
      });
      targetGroupId = group.id;
    }
  }

  if (!targetGroupId) {
    return error("VALIDATION_ERROR", "Invalid conversation", 400);
  }

  // Verify membership before sending
  const membership = await prisma.directMessageGroupMember.findUnique({
    where: { groupId_userId: { groupId: targetGroupId, userId: user.userId } },
  });
  if (!membership) {
    return error("FORBIDDEN", "Not a member of this conversation", 403);
  }

  const message = await prisma.directMessage.create({
    data: {
      senderId: user.userId,
      groupId: targetGroupId,
      content,
    },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  return success({ message, groupId: targetGroupId });
}