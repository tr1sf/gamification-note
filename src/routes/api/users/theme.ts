import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

// GET — list user's owned themes
export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const userThemes = await prisma.userTheme.findMany({
    where: { userId: user.userId },
    include: { theme: true },
  });
  return success(userThemes);
}

// POST — equip a theme (must own it)
export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const { themeId } = body;
  if (!themeId) return error("VALIDATION_ERROR", "themeId required", 400);

  const owned = await prisma.userTheme.findUnique({
    where: { userId_themeId: { userId: user.userId, themeId } },
  });
  if (!owned) return error("NOT_OWNED", "You don't own this theme", 400);

  // Unequip all, equip this one
  await prisma.$transaction([
    prisma.userTheme.updateMany({
      where: { userId: user.userId },
      data: { isEquipped: false },
    }),
    prisma.userTheme.update({
      where: { id: owned.id },
      data: { isEquipped: true },
    }),
  ]);

  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  return success({ equipped: true, theme });
}

// PUT — purchase a theme
export async function PUT({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const { themeId } = body;
  if (!themeId) return error("VALIDATION_ERROR", "themeId required", 400);

  const existing = await prisma.userTheme.findUnique({
    where: { userId_themeId: { userId: user.userId, themeId } },
  });
  if (existing) return error("ALREADY_OWNED", "Already own this theme", 409);

  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!theme || !theme.isActive) return error("NOT_FOUND", "Theme not found", 404);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Atomic coin check + decrement (prevents TOCTOU double-spend)
      const coinResult = await tx.user.updateMany({
        where: { id: user.userId, coins: { gte: theme.coinCost } },
        data: { coins: { decrement: theme.coinCost } },
      });
      if (coinResult.count === 0) throw new Error("INSUFFICIENT_COINS");

      let userTheme;
      try {
        userTheme = await tx.userTheme.create({
          data: { userId: user.userId, themeId },
        });
      } catch (e: any) {
        // P2002 = concurrent purchase raced ahead — refund coins
        if (e?.code === "P2002") {
          await tx.user.update({
            where: { id: user.userId },
            data: { coins: { increment: theme.coinCost } },
          });
          throw new Error("ALREADY_OWNED");
        }
        throw e;
      }

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: user.userId },
        select: { coins: true },
      });

      return { userTheme, coins: updatedUser.coins };
    });

    return success({ theme, coins: result.coins });
  } catch (e: any) {
    if (e?.message === "INSUFFICIENT_COINS") {
      return error("INSUFFICIENT_COINS", "Not enough coins", 400);
    }
    if (e?.message === "ALREADY_OWNED") {
      return error("ALREADY_OWNED", "You already own this theme", 409);
    }
    throw e;
  }
}
