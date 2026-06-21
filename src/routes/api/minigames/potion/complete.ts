import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { grantReward } from "~/lib/gamification/engine";
import { rateLimit } from "~/lib/rate-limit";

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  // Rate limit: max 10 game completions per minute per user.
  if (!rateLimit(`potion_complete:${user.userId}`, 10, 60000)) {
    return error("RATE_LIMITED", "Too many games. Slow down!", 429);
  }

  const body = await request.json().catch(() => ({}));
  // Validate and clamp client-supplied inputs to prevent XP farming.
  const pairCount = Math.min(Math.max(Number(body.pairCount) || 0, 0), 12);
  const correctPairs = Math.min(Math.max(Number(body.correctPairs) || 0, 0), pairCount);
  const totalFlips = Math.min(Math.max(Number(body.totalFlips) || 0, 0), 1000);
  const category = typeof body.category === "string" ? body.category : "kitchen";
  const timeTaken = Math.min(Math.max(Number(body.timeTaken) || 0, 0), 600);

  const accuracy = pairCount > 0 ? correctPairs / pairCount : 0;
  const minFlips = pairCount * 2;
  const flipEfficiency = totalFlips > 0 ? Math.min(minFlips / totalFlips, 1) : 0;

  let xp = 0, coins = 0, message = "";
  if (accuracy >= 1 && flipEfficiency >= 0.9) {
    xp = 20; coins = 30; message = "Perfect! The potion sparkles with mastery!";
  } else if (accuracy >= 0.8) {
    xp = 10; coins = 15; message = "Great work! The potion bubbles with success!";
  } else if (accuracy >= 0.5) {
    xp = 5; coins = 5; message = "Good effort! The potion is stable.";
  } else {
    xp = 2; coins = 0; message = "Keep practicing, young alchemist!";
  }

  // Always grant reward when xp > 0 OR coins > 0 (previously skipped the
  // lowest tier because the gate was `coinEarned > 0`).
  if (xp > 0 || coins > 0) {
    await grantReward({
      userId: user.userId,
      xp,
      coins,
      actionType: "minigame_complete",
      metadata: { game: "potion_match", correctPairs, totalFlips, accuracy: Math.round(accuracy * 100) },
    });
  }

  // Write minigame_perfect audit log for badge tracking (was missing — badge
  // was unobtainable because no code wrote this actionType).
  if (accuracy >= 1) {
    await prisma.auditLog.create({
      data: { userId: user.userId, actionType: "minigame_perfect", xpChange: 0, coinChange: 0, metadata: { game: "potion_match", category, accuracy: 100 } },
    });
  }

  // Check for Master Alchemist badge (2+ perfect games).
  if (accuracy >= 1) {
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
        message += " Master Alchemist badge unlocked!";
      }
    }
  }

  await prisma.auditLog.create({
    data: { userId: user.userId, actionType: "minigame_complete", xpChange: xp, coinChange: coins, metadata: { game: "potion_match", category, correctPairs, totalFlips, accuracy: Math.round(accuracy * 100) } },
  });

  return success({ xp, coins, message, accuracy: Math.round(accuracy * 100), perfect: accuracy >= 1 });
}
