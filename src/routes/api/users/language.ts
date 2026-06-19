import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

const VALID_LANGS = ["en", "vi"] as const;

export async function PUT({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const lang = body.lang;

  if (!VALID_LANGS.includes(lang)) {
    return error("INVALID", "Invalid language", 400);
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: { preferredLanguage: lang },
  });

  return success({ preferredLanguage: lang });
}
