import { prisma } from "~/lib/db";
import { verifyRefreshToken, signAccessToken, signRefreshToken, hashPassword, setAuthCookies, readRefreshToken } from "~/lib/auth/jwt";
import { success, error } from "~/lib/api-response";

export async function POST({ request }: { request: Request }) {
  const cookieHeader = request.headers.get("cookie") || "";
  const refreshToken = readRefreshToken(cookieHeader);

  if (!refreshToken) {
    return error("UNAUTHORIZED", "No refresh token", 401);
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return error("UNAUTHORIZED", "Invalid refresh token", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.refreshTokenHash) {
    return error("UNAUTHORIZED", "Session expired", 401);
  }
  if (user.isBanned) {
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
    return error("UNAUTHORIZED", "Account suspended", 401);
  }

  const bcrypt = await import("bcryptjs");
  const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!isValid) {
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
    return error("UNAUTHORIZED", "Token reuse detected", 401);
  }

  const newPayload = { userId: user.id, email: user.email, username: user.username };
  const newAccessToken = signAccessToken(newPayload);
  const newRefreshToken = signRefreshToken(newPayload);
  const newHash = await bcrypt.hash(newRefreshToken, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: newHash },
  });

  const headers = new Headers({ "Content-Type": "application/json" });
  for (const cookie of setAuthCookies(newAccessToken, newRefreshToken)) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(
    JSON.stringify({ success: true, data: null, timestamp: new Date().toISOString() }),
    { status: 200, headers }
  );
}
