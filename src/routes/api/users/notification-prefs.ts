import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);
  const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { notificationPrefs: true } });
  return success(u?.notificationPrefs || {});
}

export async function PATCH({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);
  const body = await request.json();
  await prisma.user.update({ where: { id: user.userId }, data: { notificationPrefs: body } });
  return success(body);
}
