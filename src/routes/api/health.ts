import { success } from "~/lib/api-response";
import { prisma } from "~/lib/db";

export async function GET() {
  const itemCount = await prisma.cosmeticItem.count();
  const activeCount = await prisma.cosmeticItem.count({ where: { isActive: true } });
  const items = await prisma.cosmeticItem.findMany({
    select: { name: true, type: true, coinCost: true, isActive: true },
    orderBy: { coinCost: "asc" },
  });
  return success({
    status: "ok",
    timestamp: new Date().toISOString(),
    db: {
      totalCosmeticItems: itemCount,
      activeCosmeticItems: activeCount,
      items: items.map((i) => `${i.name}(${i.type},${i.coinCost}c,active=${i.isActive})`),
    },
  });
}
