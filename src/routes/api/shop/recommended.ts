import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const [userData, totalNotes, ownedItems] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.userId }, select: { streak: true, level: true, createdAt: true } }),
    prisma.note.count({ where: { userId: user.userId, isDeleted: false } }),
    prisma.userInventory.count({ where: { userId: user.userId } }),
  ]);
  if (!userData) return success([]);

  const recNames: string[] = [];
  if (userData.streak >= 20) recNames.push("Streak Freeze");
  if (totalNotes >= 30) recNames.push("XP Booster (1h)");
  if (ownedItems >= 2) recNames.push("Focus Potion");
  if (userData.level >= 15) recNames.push("Quest Reroll");

  if (recNames.length === 0) return success([]);

  const items = await prisma.cosmeticItem.findMany({
    where: { name: { in: recNames }, isActive: true },
    take: 4,
  });
  return success(items);
}
