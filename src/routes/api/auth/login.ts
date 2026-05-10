import { prisma } from "~/lib/db";
import { signAccessToken, signRefreshToken, verifyPassword, hashPassword, setAuthCookies } from "~/lib/auth/jwt";
import { loginSchema } from "~/validators/auth";
import { success, error } from "~/lib/api-response";
import { rateLimit } from "~/lib/rate-limit";

export async function POST({ request }: { request: Request }) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`login:${ip}`, 5, 60000)) {
    return error("RATE_LIMITED", "Too many login attempts", 429);
  }

  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isBanned) {
    return error("UNAUTHORIZED", "Invalid credentials", 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return error("UNAUTHORIZED", "Invalid credentials", 401);
  }

  const payload = { userId: user.id, email: user.email, username: user.username };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const refreshHash = await hashPassword(refreshToken);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: refreshHash, lastLoginAt: new Date() },
  });

  const userData = {
    id: user.id, email: user.email, username: user.username,
    avatarUrl: user.avatarUrl, level: user.level, xp: user.xp,
    coins: user.coins, title: user.title, role: user.role,
  };

  return new Response(JSON.stringify({ success: true, data: userData, timestamp: new Date().toISOString() }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": setAuthCookies(accessToken, refreshToken).join(", "),
    },
  });
}
