import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function PATCH({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const result = await prisma.notification.updateMany({
    where: { userId: user.userId, isRead: false },
    data: { isRead: true },
  });

  return success({ markedRead: result.count });
}
