import { success } from "~/lib/api-response";
import { prisma } from "~/lib/db";

export async function GET() {
  const items = await prisma.cosmeticItem.findMany({
    select: { name: true, type: true, coinCost: true, isActive: true, rarity: true },
    orderBy: { coinCost: "asc" },
  });
  return success({
    total: items.length,
    active: items.filter((i) => i.isActive).length,
    items: items.map((i) => ({
      name: i.name,
      type: i.type,
      coin: i.coinCost,
      active: i.isActive,
      rarity: i.rarity,
    })),
  });
}
