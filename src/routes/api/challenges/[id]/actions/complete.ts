import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { processAction, triggerActionNotifications } from "~/lib/gamification/engine";

const DIFFICULTY_XP: Record<string, number> = { easy: 50, medium: 100, hard: 200, epic: 500 };
const DIFFICULTY_COINS: Record<string, number> = { easy: 10, medium: 20, hard: 50, epic: 100 };

// POST — complete an action
export async function POST({ request, params }: { request: Request; params: { id: string; aid: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

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

  // Gamification for action completion
  processAction({
    userId: user.userId,
    actionType: "create_guild",
    metadata: { challengeId: challenge.id, actionId: action.id },
  }).catch(() => {});

  // If challenge completed, grant reward
  if (result.isChallengeComplete) {
    const rewardXp = challenge.rewardXp || DIFFICULTY_XP[challenge.difficulty] || 50;
    const rewardCoins = challenge.rewardCoins || DIFFICULTY_COINS[challenge.difficulty] || 10;

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
