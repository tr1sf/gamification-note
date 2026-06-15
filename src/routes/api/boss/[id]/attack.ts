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
  if (boss.status !== "active")
    return error("INVALID_STATE", "Boss already dead", 400);

  const body = await request.json();
  const damage = body.damage || calculateBossDamage(body);
  const source = body.source || "note";

  const newHp = Math.max(
    0,
    (boss.bossCurrentHp ?? boss.bossMaxHp ?? 100) - damage
  );
  const isDead = newHp <= 0;

  await prisma.$transaction(async (tx) => {
    await tx.challenge.update({
      where: { id: params.id },
      data: {
        bossCurrentHp: newHp,
        ...(isDead
          ? { status: "completed", completedAt: new Date() }
          : {}),
      },
    });

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

  if (!isDead) {
    const { processAction } = await import("~/lib/gamification/engine");
    processAction({
      userId: user.userId,
      actionType: "create_note",
      metadata: { bossId: params.id, damage },
    }).catch(() => {});
  }

  return success({
    damage,
    newHp,
    isDead,
    bossMaxHp: boss.bossMaxHp ?? 100,
  });
}
