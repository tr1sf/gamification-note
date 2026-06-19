import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
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

  // Consumables are repeatable, so show them even if owned.
  // Badges/frames/etc. should only show once.
  const items = await prisma.cosmeticItem.findMany({
    where: {
      isActive: true,
      OR: [
        { type: "consumable" },
        ownedItemIds.length > 0
          ? { type: { not: "consumable" }, id: { notIn: ownedItemIds } }
          : { type: { not: "consumable" } },
      ],
    },
    orderBy: { coinCost: "asc" },
  });

  const ownedThemeIds = (
    await prisma.userTheme.findMany({
      where: { userId: user.userId },
      select: { themeId: true },
    })
  ).map((t) => t.themeId);

  const themes = await prisma.theme.findMany({
    where: { isActive: true, coinCost: { gt: 0 }, id: { notIn: ownedThemeIds } },
    orderBy: { coinCost: "asc" },
  });

  const themeItems = themes.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    type: "theme",
    coinCost: t.coinCost,
    rarity: t.rarity,
    isActive: t.isActive,
    imageUrl: null,
    category: { usageType: "theme", themeId: t.id },
    icon: "🎨",
  }));

  return success([...items, ...themeItems]);
}
