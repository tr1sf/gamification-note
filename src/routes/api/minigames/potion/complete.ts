import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { grantReward } from "~/lib/gamification/engine";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const { category, pairCount, correctPairs, totalFlips, timeTaken } = body;

  const accuracy = pairCount > 0 ? correctPairs / pairCount : 0;
  const minFlips = pairCount * 2;
  const flipEfficiency = totalFlips > 0 ? minFlips / totalFlips : 0;

  let xp = 0, coins = 0, message = "";
  if (accuracy >= 1 && flipEfficiency >= 0.9) {
    xp = 20; coins = 30; message = "Perfect! The potion sparkles with mastery!";
  } else if (accuracy >= 0.8) {
    xp = 10; coins = 15; message = "Great work! The potion bubbles with success!";
  } else if (accuracy >= 0.5) {
    xp = 5; coins = 5; message = "Good effort! The potion is stable.";
  } else {
    xp = 2; message = "Keep practicing, young alchemist!";
  }

  let coinEarned = coins;
  // Check for badge unlock
  if (correctPairs >= 3) {
    const perfects = await prisma.auditLog.count({
      where: { userId: user.userId, actionType: "minigame_perfect" },
    });
    if (perfects >= 2) {
      const badge = await prisma.cosmeticItem.findFirst({ where: { name: "Master Alchemist" } });
      if (badge) {
        await prisma.userInventory.upsert({
          where: { userId_cosmeticItemId: { userId: user.userId, cosmeticItemId: badge.id } },
          create: { userId: user.userId, cosmeticItemId: badge.id },
          update: {},
        });
        message += " 🧙‍♂️ Master Alchemist badge unlocked!";
      }
    }
  }

  if (coinEarned > 0) {
    const reward = await grantReward({ userId: user.userId, xp, coins: coinEarned, actionType: "minigame_complete", metadata: { game: "potion_match", correctPairs, totalFlips, accuracy } });
    xp = reward.xpGained;
    coins = reward.coinsGained;
    coinEarned = 0;
  }

  await prisma.auditLog.create({
    data: { userId: user.userId, actionType: "minigame_complete", xpChange: xp, coinChange: coins, metadata: { game: "potion_match", category, correctPairs, totalFlips, accuracy } },
  });

  return success({ xp, coins: coinEarned || coins, message, accuracy: Math.round(accuracy * 100), perfect: accuracy >= 1 });
}
