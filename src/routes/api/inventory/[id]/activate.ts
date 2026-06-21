import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

/**
 * POST /api/inventory/[id]/activate
 * Activates a consumable booster (XP Booster, Focus Potion).
 * Sets expiresAt = now + duration from item.category.durationMin.
 * The gamification engine checks for active boosters (expiresAt > now).
 */
export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const inv = await prisma.userInventory.findUnique({
    where: { id: params.id },
    include: { item: true },
  });
  if (!inv || inv.userId !== user.userId) return error("NOT_FOUND", "Item not found", 404);

  const category = inv.item.category as Record<string, unknown> | null;
  const usageType = category?.usageType as string;

  // Only booster consumables can be activated.
  if (!["xp_boost", "focus_potion"].includes(usageType)) {
    return error("INVALID", "This item cannot be activated", 400);
  }

  // Check if already active (expiresAt in the future).
  if (inv.expiresAt && inv.expiresAt > new Date()) {
    return error("ALREADY_ACTIVE", "A booster is already active", 409);
  }

  const durationMin = (category?.durationMin as number) || 60;
  const expiresAt = new Date(Date.now() + durationMin * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    // Consume one quantity (or delete if last).
    if ((inv.quantity ?? 1) > 1) {
      await tx.userInventory.update({
        where: { id: params.id },
        data: { quantity: { decrement: 1 }, expiresAt },
      });
    } else {
      await tx.userInventory.update({
        where: { id: params.id },
        data: { expiresAt },
      });
    }
  });

  return success({
    activated: true,
    item: inv.item.name,
    expiresAt: expiresAt.toISOString(),
    durationMin,
  });
}
