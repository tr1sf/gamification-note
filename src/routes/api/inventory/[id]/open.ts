import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const inv = await prisma.userInventory.findUnique({
    where: { id: params.id },
    include: { item: true },
  });
  if (!inv || inv.userId !== user.userId) return error("NOT_FOUND", "Not found", 404);

  const usageType = (inv.item.category as Record<string, unknown> | null)?.usageType;
  if (usageType !== "loot_box") return error("INVALID", "Not a loot box", 400);

  const items = await prisma.cosmeticItem.findMany({
    where: { type: { not: "consumable" }, isActive: true },
  });

  if (items.length === 0) return error("EMPTY", "No items available", 500);

  const randomItem = items[Math.floor(Math.random() * items.length)];

  await prisma.$transaction(async (tx) => {
    await tx.userInventory.upsert({
      where: { userId_cosmeticItemId: { userId: user.userId, cosmeticItemId: randomItem.id } },
      create: { userId: user.userId, cosmeticItemId: randomItem.id, quantity: 1 },
      update: { quantity: { increment: 1 } },
    });
    if ((inv.quantity ?? 1) > 1) {
      await tx.userInventory.update({
        where: { id: params.id },
        data: { quantity: { decrement: 1 } },
      });
    } else {
      await tx.userInventory.delete({ where: { id: params.id } });
    }
  });

  return success({
    id: randomItem.id,
    name: randomItem.name,
    type: randomItem.type,
    rarity: randomItem.rarity,
  });
}
