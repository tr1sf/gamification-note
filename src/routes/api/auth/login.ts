import { prisma } from "~/lib/db";
import { signAccessToken, signRefreshToken, verifyPassword, hashPassword, setAuthCookies } from "~/lib/auth/jwt";
import { loginSchema } from "~/validators/auth";
import { success, error } from "~/lib/api-response";
import { rateLimit } from "~/lib/rate-limit";
import { processAction } from "~/lib/gamification/engine";
import { startSession } from "~/lib/analytics/session";
import { runNudgeEngine } from "~/lib/notifications/nudge-engine";
import { spawnDailyBoss, spawnWeeklyBoss } from "~/lib/boss/spawner";
import { createNotification } from "~/lib/socket/notifications";

async function calculateLoginStreak(userId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const auditLogs = await prisma.auditLog.findMany({
    where: { userId, actionType: "daily_login", createdAt: { lt: todayStart } },
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

export async function POST(event: { request: Request }) {
  try {
    return await handleLogin(event);
  } catch (err) {
    console.error("[auth/login] unhandled error:", err);
    return error("INTERNAL_ERROR", "Something went wrong on our end. Please try again.", 500);
  }
}

async function handleLogin({ request }: { request: Request }) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`login:${ip}`, 5, 60000)) {
    return error("RATE_LIMITED", "Too many login attempts", 429);
  }

  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  const { login, password } = parsed.data;
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: login }, { username: login }] },
  });
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

  let streak = await calculateLoginStreak(user.id);

  if (streak === 0) {
    const freezes = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT ui.id FROM "UserInventory" ui
      JOIN "CosmeticItem" ci ON ui."cosmeticItemId" = ci.id
      WHERE ui."userId" = ${user.id}::uuid
        AND ci.category->>'usageType' = 'streak_freeze'
      LIMIT 1
    `;
    const hasFreeze = freezes.length > 0;

    if (hasFreeze) {
      await prisma.userInventory.delete({ where: { id: freezes[0].id } });
      streak = user.streak;
    }
  }

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
      gamificationStyle: true, path: true, onboardingCompleted: true, createdAt: true,
      notificationPrefs: true,
    },
  });

  startSession(user.id).catch(() => {});
  runNudgeEngine(user.id).catch(() => {});
  spawnDailyBoss(user.id, updatedUser?.level ?? 1).then(async (bossId) => {
    if (bossId) {
      const boss = await prisma.challenge.findUnique({ where: { id: bossId }, select: { bossName: true } });
      if (boss) {
        createNotification(user.id, "boss_spawn", "A foe appears!", `${boss.bossName} is lurking in the shadows. Attack while you can!`).catch(() => {});
      }
    }
  }).catch(() => {});
  spawnWeeklyBoss(user.id, updatedUser?.level ?? 1).then(async (bossId) => {
    if (bossId) {
      const boss = await prisma.challenge.findUnique({ where: { id: bossId }, select: { bossName: true } });
      if (boss) {
        createNotification(user.id, "boss_spawn", "A powerful foe appears!", `${boss.bossName} has emerged! Gather your strength this week!`).catch(() => {});
      }
    }
  }).catch(() => {});

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
