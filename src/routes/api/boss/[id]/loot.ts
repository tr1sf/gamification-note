import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

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
  if (!boss) return error("NOT_FOUND", "Boss not found", 404);
  if (boss.userId !== user.userId)
    return error("FORBIDDEN", "Not your boss", 403);
  if (boss.status !== "completed")
    return error("INVALID_STATE", "Boss not defeated yet", 400);

  // Atomic claim guard — prevents double-loot via concurrent requests.
  const claim = await prisma.challenge.updateMany({
    where: { id: params.id, lootClaimed: false },
    data: { lootClaimed: true },
  });
  if (claim.count === 0)
    return error("ALREADY_CLAIMED", "Loot already claimed", 400);

  const roll = Math.random();
  const lootTable = (boss.lootTable as any[]) || [
    { type: "coins", dropChance: 0.7, amount: 20 },
    { type: "consumable", dropChance: 0.2, name: "XP Booster (1h)" },
  ];

  // Normalize entries: lootTable may use `itemType` or `type`.
  // Standardize to `type` so the dispatch below matches correctly.
  let loot: any = { type: "coins", amount: 5 };
  let cumulative = 0;
  for (const entry of lootTable) {
    cumulative += entry.dropChance;
    if (roll <= cumulative) {
      loot = { ...entry, type: entry.type ?? entry.itemType };
      break;
    }
  }

  // Always grant the base boss reward (XP + coins), regardless of loot type.
  const { grantReward } = await import("~/lib/gamification/engine");

  if (loot.type === "coins") {
    await grantReward({
      userId: user.userId,
      xp: boss.rewardXp ?? 0,
      coins: (boss.rewardCoins ?? 0) + (loot.amount ?? 0),
      actionType: "boss_kill",
      metadata: { bossId: boss.id, bossName: boss.bossName },
    });
  } else if (loot.type === "consumable" || loot.type === "badge" || loot.type === "frame" || loot.type === "avatar_frame") {
    const item = await prisma.cosmeticItem.findFirst({
      where: {
        type: loot.type === "avatar_frame" ? "avatar_frame" : loot.type,
        isActive: true,
      },
      orderBy: { coinCost: "asc" },
    });
    if (item) {
      await prisma.userInventory.upsert({
        where: { userId_cosmeticItemId: { userId: user.userId, cosmeticItemId: item.id } },
        create: { userId: user.userId, cosmeticItemId: item.id },
        update: {},
      });

      await grantReward({
        userId: user.userId,
        xp: boss.rewardXp ?? 0,
        coins: boss.rewardCoins ?? 0,
        actionType: "boss_kill",
        metadata: { bossId: boss.id, bossName: boss.bossName, lootType: loot.type, itemName: item.name },
      });
    } else {
      // Fallback: if no item found, grant coins instead.
      await grantReward({
        userId: user.userId,
        xp: boss.rewardXp ?? 0,
        coins: (boss.rewardCoins ?? 0) + 30,
        actionType: "boss_kill",
        metadata: { bossId: boss.id, bossName: boss.bossName, lootFallback: true },
      });
    }
  } else {
    // Unknown loot type — grant base reward only.
    await grantReward({
      userId: user.userId,
      xp: boss.rewardXp ?? 0,
      coins: boss.rewardCoins ?? 0,
      actionType: "boss_kill",
      metadata: { bossId: boss.id, bossName: boss.bossName },
    });
  }

  const lootMessage = loot.type === "coins"
    ? `${loot.amount} bonus coins`
    : loot.type === "consumable"
    ? loot.name || "Consumable"
    : loot.type === "badge" ? "New badge!"
    : loot.type === "frame" || loot.type === "avatar_frame" ? "New frame!"
    : loot.name ?? loot.type;

  return success({
    loot,
    message: `Defeated ${boss.bossName ?? "boss"}! Loot: ${lootMessage}`,
  });
}
