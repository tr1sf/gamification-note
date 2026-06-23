import { prisma } from "~/lib/db";
import { verifyAccessToken, readAccessToken } from "~/lib/auth/jwt";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = readAccessToken(cookieHeader);

  if (!token) {
    return error("UNAUTHORIZED", "No access token", 401);
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return error("UNAUTHORIZED", "Invalid token", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true, email: true, username: true, avatarUrl: true,
      level: true, xp: true, coins: true, streak: true, title: true, role: true,
      gamificationStyle: true, path: true, onboardingCompleted: true, createdAt: true, isBanned: true,
      notificationPrefs: true, preferredLanguage: true,
    },
  });

  if (!user || user.isBanned) {
    return error("UNAUTHORIZED", "Account not found", 401);
  }

  return success(user);
}
