import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const ownedItemIds = (
    await prisma.userInventory.findMany({
      where: { userId: user.userId },
      select: { cosmeticItemId: true },
    })
  ).map((i) => i.cosmeticItemId);

  const items = await prisma.cosmeticItem.findMany({
    where: {
      isActive: true,
      id: ownedItemIds.length > 0 ? { notIn: ownedItemIds } : undefined,
    },
    orderBy: { coinCost: "asc" },
  });

  const userData = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { coins: true },
  });

  return success(items, { coins: userData?.coins ?? 0 });
}
