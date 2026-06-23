import { getUserFromRequest } from "~/lib/auth/get-user";
import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const { name, memberIds } = await request.json();

  if (!memberIds || memberIds.length < 1 || memberIds.length > 7) {
    return error("VALIDATION_ERROR", "Group must have 2-8 members", 400);
  }

  if (memberIds.length === 1) {
    const userGroups = await prisma.directMessageGroupMember.findMany({
      where: { userId: user.userId },
      include: { group: { include: { members: { select: { userId: true } } } } },
    });

    const existing = userGroups.find(
      (ug) =>
        ug.group.members.length === 2 &&
        ug.group.members.some((m) => m.userId === memberIds[0])
    );

    if (existing) return success(existing.group);
  }

  const group = await prisma.directMessageGroup.create({
    data: {
      name,
      members: {
        create: [
          { userId: user.userId },
          ...memberIds.map((id: string) => ({ userId: id })),
        ],
      },
    },
  });

  return success(group);
}