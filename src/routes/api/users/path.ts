import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

const VALID_PATHS = ["student", "professional", "journaler"];

export async function PATCH({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json().catch(() => ({}));
  const path = body.path as string;

  if (!path || !VALID_PATHS.includes(path)) {
    return error("VALIDATION_ERROR", "Invalid path. Must be student, professional, or journaler.", 400);
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: { path },
  });

  return success({ path });
}
