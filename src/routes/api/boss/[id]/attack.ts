import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { calculateBossDamage } from "~/lib/boss/damage";
import { rateLimit } from "~/lib/rate-limit";

export async function POST({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  // Rate limit: one attack per 30 seconds per boss
  if (!rateLimit(`boss_attack:${user.userId}:${params.id}`, 1, 30000)) {
    return error("RATE_LIMITED", "Wait before attacking again", 429);
  }

  const boss = await prisma.challenge.findUnique({ where: { id: params.id } });
  if (!boss || !boss.bossType)
    return error("NOT_FOUND", "Boss not found", 404);
  if (boss.userId !== user.userId)
    return error("FORBIDDEN", "Not your boss", 403);
  if (boss.status !== "active")
    return error("INVALID_STATE", "Boss already dead", 400);

  const body = await request.json().catch(() => ({}));
  const validActionTypes = ["note", "quiz", "habit", "focus"] as const;
  const actionType = validActionTypes.includes(body.actionType) ? body.actionType : (body.source || "note");

  // Compute combo server-side from recent attacks
  const recentAttacks = await prisma.auditLog.count({
    where: {
      userId: user.userId,
      actionType: "boss_damage",
      createdAt: { gte: new Date(Date.now() - 86400000) },
    },
  });
  const comboMultiplier = recentAttacks >= 3 ? 1.5 : 1.0;

  // Validate + clamp client-supplied params to prevent inflated damage.
  const damage = Math.round(
    calculateBossDamage({
      actionType,
      structureScore: typeof body.structureScore === "number" ? Math.min(body.structureScore, 100) : undefined,
      quizAccuracy: typeof body.quizAccuracy === "number" ? Math.min(body.quizAccuracy, 1) : undefined,
      quizStreak: typeof body.quizStreak === "number" ? Math.min(body.quizStreak, 20) : undefined,
      habitStreak: typeof body.habitStreak === "number" ? Math.min(body.habitStreak, 50) : undefined,
    }) * comboMultiplier
  );

  const maxHp = boss.bossMaxHp ?? 100;

  const actuallyDead = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE "Challenge" SET "bossCurrentHp" = GREATEST(0, "bossCurrentHp" - ${damage}) WHERE id = ${params.id}::uuid`;

    const updated = await tx.challenge.findUnique({
      where: { id: params.id },
      select: { bossCurrentHp: true },
    });
    const isDead = (updated?.bossCurrentHp ?? 0) <= 0;

    if (isDead) {
      await tx.challenge.update({
        where: { id: params.id },
        data: { status: "completed", completedAt: new Date() },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        actionType: "boss_damage",
        xpChange: 0,
        coinChange: 0,
        metadata: {
          bossId: params.id,
          damage,
          source: actionType,
          isDead,
          bossName: boss.bossName,
        },
      },
    });

    return isDead;
  });

  const updated = await prisma.challenge.findUnique({
    where: { id: params.id },
    select: { bossCurrentHp: true },
  });

  return success({
    damage,
    newHp: updated?.bossCurrentHp ?? Math.max(0, (boss.bossCurrentHp ?? maxHp) - damage),
    isDead: actuallyDead,
    bossMaxHp: maxHp,
  });
}
