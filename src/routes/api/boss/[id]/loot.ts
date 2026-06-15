import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const boss = await prisma.challenge.findUnique({ where: { id: params.id } });
  if (!boss) return error("NOT_FOUND", "Boss not found", 404);
  if (boss.status !== "completed")
    return error("INVALID_STATE", "Boss not defeated yet", 400);
  if (boss.lootClaimed)
    return error("ALREADY_CLAIMED", "Loot already claimed", 400);

  const roll = Math.random();
  const lootTable = (boss.lootTable as any[]) || [
    { itemType: "coins", dropChance: 0.7, amount: 20 },
    { itemType: "consumable", dropChance: 0.2, name: "XP Booster (1h)" },
  ];

  let loot: any = { type: "coins", amount: 5 };
  for (const entry of lootTable) {
    if (roll <= entry.dropChance) {
      loot = entry;
      break;
    }
  }

  if (loot.type === "coins") {
    const { grantReward } = await import("~/lib/gamification/engine");
    await grantReward({
      userId: user.userId,
      xp: boss.rewardXp ?? 0,
      coins: (boss.rewardCoins ?? 0) + (loot.amount ?? 0),
      actionType: "boss_kill",
      metadata: { bossId: boss.id, bossName: boss.bossName },
    });
  }

  await prisma.challenge.update({
    where: { id: params.id },
    data: { lootClaimed: true },
  });

  return success({
    loot,
    message: `Defeated ${boss.bossName ?? "boss"}! Loot: ${
      loot.type === "coins"
        ? `${loot.amount} bonus coins`
        : loot.name ?? loot.type
    }`,
  });
}
