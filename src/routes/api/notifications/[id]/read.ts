import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
  });
  if (!notification) return error("NOT_FOUND", "Notification not found", 404);
  if (notification.userId !== user.userId) {
    return error("FORBIDDEN", "Not your notification", 403);
  }

  await prisma.notification.update({
    where: { id: params.id },
    data: { isRead: true },
  });

  return success(null);
}
