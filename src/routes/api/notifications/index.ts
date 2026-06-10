import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const take = Math.min(parseInt(url.searchParams.get("take") || "20"), 50);

  const notifications = await prisma.notification.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      isRead: true,
      metadata: true,
      createdAt: true,
    },
  });

  const hasMore = notifications.length > take;
  if (hasMore) notifications.pop();

  return success({
    items: notifications,
    nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
  });
}
