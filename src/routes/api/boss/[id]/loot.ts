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
  if (boss.userId !== user.userId)
    return error("FORBIDDEN", "Not your boss", 403);
  if (boss.status !== "completed")
    return error("INVALID_STATE", "Boss not defeated yet", 400);

  // Atomic claim: only the request that flips lootClaimed from false→true succeeds
  const claim = await prisma.challenge.updateMany({
    where: { id: params.id, lootClaimed: false },
    data: { lootClaimed: true },
  });
  if (claim.count === 0)
    return error("ALREADY_CLAIMED", "Loot already claimed", 400);

  // Cumulative probability: items with lower dropChance can actually drop
  const roll = Math.random();
  const lootTable = (boss.lootTable as any[]) || [
    { itemType: "coins", dropChance: 0.7, amount: 20 },
    { itemType: "consumable", dropChance: 0.2, name: "XP Booster (1h)" },
  ];

  let loot: any = { type: "coins", amount: 5 };
  let cumulative = 0;
  for (const entry of lootTable) {
    cumulative += entry.dropChance;
    if (roll <= cumulative) {
      loot = entry;
      break;
    }
  }

  // Grant rewards
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

  return success({
    loot,
    message: `Defeated ${boss.bossName ?? "boss"}! Loot: ${
      loot.type === "coins"
        ? `${loot.amount} bonus coins`
        : loot.name ?? loot.type
    }`,
  });
}
