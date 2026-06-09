import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function POST({ request, params }: { request: Request; params: { itemId: string } }) {
  const user = (request as any).locals?.user;
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const item = await prisma.cosmeticItem.findUnique({
    where: { id: params.itemId },
  });

  if (!item || !item.isActive) {
    return error("NOT_FOUND", "Item not found", 404);
  }

  const existing = await prisma.userInventory.findUnique({
    where: {
      userId_cosmeticItemId: { userId: user.userId, cosmeticItemId: params.itemId },
    },
  });

  if (existing) {
    return error("ALREADY_OWNED", "You already own this item", 409);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUniqueOrThrow({
        where: { id: user.userId },
        select: { coins: true },
      });

      if (currentUser.coins < item.coinCost) {
        throw new Error("INSUFFICIENT_COINS");
      }

      await tx.user.update({
        where: { id: user.userId },
        data: { coins: { decrement: item.coinCost } },
      });

      const inventoryItem = await tx.userInventory.create({
        data: {
          userId: user.userId,
          cosmeticItemId: params.itemId,
        },
      });

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: user.userId },
        select: { coins: true },
      });

      return { inventoryItem, coins: updatedUser.coins };
    });

    return success({
      item: result.inventoryItem,
      coins: result.coins,
    });
  } catch (e: any) {
    if (e?.message === "INSUFFICIENT_COINS") {
      return error("INSUFFICIENT_COINS", "Not enough coins", 400);
    }
    throw e;
  }
}
