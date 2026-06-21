import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { grantReward } from "~/lib/gamification/engine";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json().catch(() => ({}));
  const gamificationStyle = body.gamificationStyle as string | undefined;
  const path = body.path as string | undefined;

  // Idempotency: if the user already completed onboarding, don't grant the
  // 50-coin reward again. Previously a loop of POST /onboarding/complete
  // granted +50 coins per call indefinitely.
  const existing = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { onboardingCompleted: true },
  });
  if (existing?.onboardingCompleted) {
    return success({ alreadyCompleted: true, coinsGained: 0, badgeAwarded: null });
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: {
      onboardingCompleted: true,
      ...(gamificationStyle ? { gamificationStyle } : {}),
      ...(path ? { path } : {}),
    },
  });

  const badge = await prisma.cosmeticItem.findFirst({
    where: { name: "Beginner Badge" },
  });

  if (badge) {
    await prisma.userInventory.upsert({
      where: {
        userId_cosmeticItemId: {
          userId: user.userId,
          cosmeticItemId: badge.id,
        },
      },
      create: {
        userId: user.userId,
        cosmeticItemId: badge.id,
      },
      update: {},
    });
  }

  const reward = await grantReward({
    userId: user.userId,
    xp: 0,
    coins: 50,
    actionType: "onboarding_complete",
    metadata: { source: "welcome_gift" },
  });

  return success({
    coinsGained: reward.coinsGained,
    badgeAwarded: badge ? badge.name : null,
  });
}
