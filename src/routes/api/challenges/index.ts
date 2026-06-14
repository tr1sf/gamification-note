import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { processAction } from "~/lib/gamification/engine";

const DIFFICULTY_XP: Record<string, number> = { easy: 50, medium: 100, hard: 200, epic: 500 };
const DIFFICULTY_COINS: Record<string, number> = { easy: 10, medium: 20, hard: 50, epic: 100 };

// POST — create a new challenge
export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const { title, description, theme, difficulty, iconEmoji, targetProgress, rewardXp, rewardCoins, isPublic, actions } = body;

  if (!title || typeof title !== "string" || title.length < 2 || title.length > 100) {
    return error("VALIDATION_ERROR", "Title must be 2-100 characters", 400);
  }

  const challenge = await prisma.challenge.create({
    data: {
      userId: user.userId,
      title,
      description: description || null,
      theme: theme || "growth",
      difficulty: difficulty || "medium",
      iconEmoji: iconEmoji || null,
      targetProgress: targetProgress || 100,
      rewardXp: rewardXp || DIFFICULTY_XP[difficulty] || 50,
      rewardCoins: rewardCoins || DIFFICULTY_COINS[difficulty] || 10,
      isPublic: isPublic || false,
      actions: actions?.length > 0
        ? {
            create: actions.map((a: any, i: number) => ({
              title: a.title,
              description: a.description || null,
              iconEmoji: a.iconEmoji || null,
              progressValue: a.progressValue || 10,
              order: i,
              linkedActionType: a.linkedActionType || null,
              linkedTarget: a.linkedTarget || null,
              isRepeatable: a.isRepeatable || false,
              maxRepeats: a.maxRepeats || null,
            })),
          }
        : undefined,
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  processAction({
    userId: user.userId,
    actionType: "create_note",
    metadata: { source: "challenge", challengeId: challenge.id, challengeTitle: challenge.title },
  }).catch(() => {});

  return success(challenge);
}

// GET — list user's challenges
export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "active";

  const challenges = await prisma.challenge.findMany({
    where: { userId: user.userId, status },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { actions: true } } },
  });

  return success(challenges);
}
