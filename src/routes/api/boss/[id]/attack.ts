import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { calculateBossDamage } from "~/lib/boss/damage";

export async function POST({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const boss = await prisma.challenge.findUnique({ where: { id: params.id } });
  if (!boss || !boss.bossType)
    return error("NOT_FOUND", "Boss not found", 404);
  if (boss.userId !== user.userId)
    return error("FORBIDDEN", "Not your boss", 403);
  if (boss.status !== "active")
    return error("INVALID_STATE", "Boss already dead", 400);

  const body = await request.json();
  // Always calculate damage server-side — never trust client-provided damage
  const damage = calculateBossDamage(body);
  const source = body.source || "note";

  const maxHp = boss.bossMaxHp ?? 100;
  const isDead = (boss.bossCurrentHp ?? maxHp) - damage <= 0;

  await prisma.$transaction(async (tx) => {
    // Atomic HP decrement using raw SQL to prevent race conditions
    await tx.$executeRaw`UPDATE "Challenge" SET "bossCurrentHp" = GREATEST(0, "bossCurrentHp" - ${damage}) WHERE id = ${params.id}::uuid`;

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
          source,
          isDead,
          bossName: boss.bossName,
        },
      },
    });
  });

  // Fire-and-forget XP for attacking
  if (!isDead) {
    const { processAction } = await import("~/lib/gamification/engine");
    processAction({
      userId: user.userId,
      actionType: "create_note",
      metadata: { bossId: params.id, damage },
    }).catch(() => {});
  }

  // Read final HP
  const updated = await prisma.challenge.findUnique({
    where: { id: params.id },
    select: { bossCurrentHp: true },
  });

  return success({
    damage,
    newHp: updated?.bossCurrentHp ?? Math.max(0, (boss.bossCurrentHp ?? maxHp) - damage),
    isDead,
    bossMaxHp: maxHp,
  });
}
