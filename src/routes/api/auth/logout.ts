import { prisma } from "~/lib/db";
import { clearAuthCookies, verifyAccessToken } from "~/lib/auth/jwt";
import { success, error } from "~/lib/api-response";

export async function POST({ request }: { request: Request }) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader
    .split("; ")
    .find((c) => c.startsWith("access_token="))
    ?.split("=")[1];

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      await prisma.user.update({
        where: { id: payload.userId },
        data: { refreshTokenHash: null },
      });
    } catch {
      // Token expired or invalid — clear cookies anyway
    }
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  for (const cookie of clearAuthCookies()) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(
    JSON.stringify({ success: true, data: null, timestamp: new Date().toISOString() }),
    { status: 200, headers }
  );
}
