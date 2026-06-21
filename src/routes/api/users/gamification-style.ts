import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

const VALID_STYLES = ["competitive", "balanced", "collaborative", "solo", "minimal"];

export async function PATCH({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json().catch(() => ({}));
  const style = body.gamificationStyle as string;

  if (!style || !VALID_STYLES.includes(style)) {
    return error("VALIDATION_ERROR", "Invalid gamification style", 400);
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: { gamificationStyle: style },
  });

  return success({ gamificationStyle: style });
}
