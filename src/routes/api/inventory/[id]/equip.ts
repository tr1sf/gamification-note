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

  const item = inv.item;
  if (item.type === "consumable") return error("INVALID", "Cannot equip consumables", 400);

  await prisma.$transaction(async (tx) => {
    const sameTypeItems = await tx.userInventory.findMany({
      where: { userId: user.userId, isEquipped: true, item: { type: item.type } },
    });
    for (const si of sameTypeItems) {
      await tx.userInventory.update({ where: { id: si.id }, data: { isEquipped: false } });
    }
    await tx.userInventory.update({
      where: { id: params.id },
      data: { isEquipped: true },
    });
  });

  return success({ equipped: true });
}
