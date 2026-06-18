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

  const claim = await prisma.challenge.updateMany({
    where: { id: params.id, lootClaimed: false },
    data: { lootClaimed: true },
  });
  if (claim.count === 0)
    return error("ALREADY_CLAIMED", "Loot already claimed", 400);

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

  if (loot.type === "coins") {
    const { grantReward } = await import("~/lib/gamification/engine");
    await grantReward({
      userId: user.userId,
      xp: boss.rewardXp ?? 0,
      coins: (boss.rewardCoins ?? 0) + (loot.amount ?? 0),
      actionType: "boss_kill",
      metadata: { bossId: boss.id, bossName: boss.bossName },
    });
  } else if (loot.type === "consumable" || loot.type === "badge" || loot.type === "frame") {
    const item = await prisma.cosmeticItem.findFirst({
      where: { type: loot.type, isActive: true },
      orderBy: { coinCost: "asc" },
    });
    if (item) {
      await prisma.userInventory.upsert({
        where: { userId_cosmeticItemId: { userId: user.userId, cosmeticItemId: item.id } },
        create: { userId: user.userId, cosmeticItemId: item.id },
        update: {},
      });

      const { grantReward } = await import("~/lib/gamification/engine");
      await grantReward({
        userId: user.userId,
        xp: boss.rewardXp ?? 0,
        coins: boss.rewardCoins ?? 0,
        actionType: "boss_kill",
        metadata: { bossId: boss.id, bossName: boss.bossName, lootType: loot.type, itemName: item.name },
      });
    }
  }

  const lootMessage = loot.type === "coins"
    ? `${loot.amount} bonus coins`
    : loot.type === "consumable"
    ? loot.name || "Consumable"
    : loot.type === "badge" ? "New badge!"
    : loot.type === "frame" ? "New frame!"
    : loot.name ?? loot.type;

  return success({
    loot,
    message: `Defeated ${boss.bossName ?? "boss"}! Loot: ${lootMessage}`,
  });
}
