import { prisma } from "~/lib/db";
import { signAccessToken, signRefreshToken, verifyPassword, hashPassword, setAuthCookies } from "~/lib/auth/jwt";
import { loginSchema } from "~/validators/auth";
import { success, error } from "~/lib/api-response";
import { rateLimit } from "~/lib/rate-limit";
import { processAction } from "~/lib/gamification/engine";

async function calculateLoginStreak(userId: string): Promise<number> {
  const auditLogs = await prisma.auditLog.findMany({
    where: { userId, actionType: "daily_login" },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 365,
  });

  if (auditLogs.length === 0) return 0;

  const uniqueDates = new Set<string>();
  for (const log of auditLogs) {
    uniqueDates.add(log.createdAt.toISOString().slice(0, 10));
  }
  const dates = Array.from(uniqueDates).sort().reverse();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dates[0] !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const current = new Date(dates[i - 1]);
    const prev = new Date(dates[i]);
    const diffDays = (current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (Math.abs(diffDays - 1) < 0.01) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

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

  const streak = await calculateLoginStreak(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { streak: streak + 1 },
  });

  const gamification = await processAction({
    userId: user.id,
    actionType: "daily_login",
    metadata: { streak: streak + 1 },
  });

  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, email: true, username: true, avatarUrl: true,
      level: true, xp: true, coins: true, streak: true, title: true, role: true,
      createdAt: true,
    },
  });

  const headers = new Headers({ "Content-Type": "application/json" });
  for (const cookie of setAuthCookies(accessToken, refreshToken)) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(JSON.stringify({
    success: true,
    data: { ...updatedUser, gamification },
    timestamp: new Date().toISOString(),
  }), { status: 200, headers });
}
