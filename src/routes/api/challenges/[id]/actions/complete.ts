import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { processAction } from "~/lib/gamification/engine";
import { rateLimit } from "~/lib/rate-limit";

const DIFFICULTY_XP: Record<string, number> = { easy: 50, medium: 100, hard: 200, epic: 500 };
const DIFFICULTY_COINS: Record<string, number> = { easy: 10, medium: 20, hard: 50, epic: 100 };
const MAX_CHALLENGE_COMPLETES_PER_DAY = 5;

// POST — complete an action
export async function POST({ request, params }: { request: Request; params: { id: string; aid: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  // Rate limit: 10 action completions per minute per user
  if (!rateLimit(`challenge_action:${user.userId}`, 10, 60000)) {
    return error("RATE_LIMITED", "Too many actions. Slow down!", 429);
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id: params.id },
    include: { actions: { where: { id: params.aid } } },
  });

  if (!challenge) return error("NOT_FOUND", "Challenge not found", 404);
  if (challenge.userId !== user.userId) return error("FORBIDDEN", "Not your challenge", 403);
  if (challenge.status !== "active") return error("INVALID_STATE", "Challenge is not active", 400);

  const action = challenge.actions[0];
  if (!action) return error("NOT_FOUND", "Action not found", 404);
  if (action.status === "completed" && !action.isRepeatable) {
    return error("ALREADY_COMPLETED", "Action already completed", 400);
  }

  // Check max repeats for repeatable actions
  if (action.isRepeatable && (action.maxRepeats ?? 0) > 0 && action.repeatCount >= (action.maxRepeats ?? 0)) {
    return error("MAX_REPEATS", "Action reached max repeats", 400);
  }

  // Limit challenge completions per day to prevent reward farming
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const completedCount = await prisma.challenge.count({
    where: {
      userId: user.userId,
      status: "completed",
      completedAt: { gte: todayStart },
    },
  });
  if (completedCount >= MAX_CHALLENGE_COMPLETES_PER_DAY && challenge.currentProgress + action.progressValue >= challenge.targetProgress) {
    return error("DAILY_LIMIT", `Max ${MAX_CHALLENGE_COMPLETES_PER_DAY} challenge completions per day`, 429);
  }

  const rewardXp = challenge.rewardXp || DIFFICULTY_XP[challenge.difficulty] || 50;
  const rewardCoins = challenge.rewardCoins || DIFFICULTY_COINS[challenge.difficulty] || 10;

  // Run everything in a single transaction so gamification rewards are atomic
  // with progress updates.
  const result = await prisma.$transaction(async (tx) => {
    await tx.challengeAction.update({
      where: { id: action.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        ...(action.linkedActionType ? { linkedProgress: { increment: 1 } } : {}),
        ...(action.isRepeatable ? { repeatCount: { increment: 1 }, status: "active", completedAt: null } : {}),
      },
    });

    const newProgress = Math.min(challenge.targetProgress, challenge.currentProgress + action.progressValue);
    const isChallengeComplete = newProgress >= challenge.targetProgress;

    await tx.challenge.update({
      where: { id: params.id },
      data: {
        currentProgress: newProgress,
        ...(isChallengeComplete ? { status: "completed", completedAt: new Date() } : {}),
      },
    });

    return { isChallengeComplete };
  });

  // Gamification is fire-and-forget outside the transaction — it has its own
  // FOR UPDATE locking on the User row. If it fails the challenge progress is
  // still correct; the user can reclaim rewards manually if needed.
  // NOTE: Only fire the reward when the challenge completes — not on every
  // action, to avoid double XP/coins from two processAction calls.
  if (result.isChallengeComplete) {
    const gamification = await processAction({
      userId: user.userId,
      actionType: "complete_quest",
      metadata: { xpReward: rewardXp, coinReward: rewardCoins, challengeId: challenge.id, challengeTitle: challenge.title },
    });

    return success({
      actionCompleted: true,
      challengeCompleted: true,
      gamification,
    });
  }

  return success({ actionCompleted: true, challengeCompleted: false });
}