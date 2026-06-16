import { prisma } from "~/lib/db";
import { verifyAccessToken } from "~/lib/auth/jwt";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader
    .split("; ")
    .find((c) => c.startsWith("access_token="))
    ?.split("=")[1];

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
    },
  });

  if (!user || user.isBanned) {
    return error("UNAUTHORIZED", "Account not found", 401);
  }

  return success(user);
}
