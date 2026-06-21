import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { track } from "~/lib/analytics/tracker";

export async function POST({ request, params }: { request: Request; params: { itemId: string } }) {
  const user = getUserFromRequest(request);
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

  // Non-consumables can only be owned once.
  if (existing && item.type !== "consumable") {
    return error("ALREADY_OWNED", "You already own this item", 409);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Atomic coin check: conditional updateMany only succeeds if the user
      // has enough coins — prevents TOCTOU double-spend on concurrent
      // purchases (previously: read coins → check → decrement was racy).
      const coinResult = await tx.user.updateMany({
        where: { id: user.userId, coins: { gte: item.coinCost } },
        data: { coins: { decrement: item.coinCost } },
      });
      if (coinResult.count === 0) {
        throw new Error("INSUFFICIENT_COINS");
      }

      let inventoryItem;
      const category = item.category as Record<string, unknown> | null;
      let expiresAt: Date | undefined;
      if (category?.durationMin && typeof category.durationMin === "number") {
        expiresAt = new Date(Date.now() + category.durationMin * 60 * 1000);
      }

      try {
        if (item.type === "consumable" && existing) {
          // Stack consumables by incrementing quantity.
          inventoryItem = await tx.userInventory.update({
            where: { id: existing.id },
            data: { quantity: { increment: 1 }, ...(expiresAt ? { expiresAt } : {}) },
          });
        } else {
          inventoryItem = await tx.userInventory.create({
            data: {
              userId: user.userId,
              cosmeticItemId: params.itemId,
              quantity: 1,
              ...(expiresAt ? { expiresAt } : {}),
            },
          });
        }
      } catch (e: any) {
        // P2002 = unique constraint violation on (userId, cosmeticItemId) —
        // a concurrent purchase of the same non-consumable raced ahead.
        if (e?.code === "P2002") {
          // Refund the coins we just deducted.
          await tx.user.update({
            where: { id: user.userId },
            data: { coins: { increment: item.coinCost } },
          });
          throw new Error("ALREADY_OWNED");
        }
        throw e;
      }

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: user.userId },
        select: { coins: true },
      });

      return { inventoryItem, coins: updatedUser.coins };
    });

    track({
      userId: user.userId,
      actionType: "coin_spend",
      metadata: { itemType: item.type, itemName: item.name, coinCost: item.coinCost, coinBalance: result.coins },
    });

    return success({
      item: result.inventoryItem,
      coins: result.coins,
    });
  } catch (e: any) {
    if (e?.message === "INSUFFICIENT_COINS") {
      return error("INSUFFICIENT_COINS", "Not enough coins", 400);
    }
    if (e?.message === "ALREADY_OWNED") {
      return error("ALREADY_OWNED", "You already own this item", 409);
    }
    throw e;
  }
}
