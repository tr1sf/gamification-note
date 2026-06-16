import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { processAction } from "~/lib/gamification/engine";

// GET — challenge detail
export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const challenge = await prisma.challenge.findUnique({
    where: { id: params.id },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  if (!challenge) return error("NOT_FOUND", "Challenge not found", 404);
  if (challenge.userId !== user.userId && !challenge.isPublic) {
    return error("FORBIDDEN", "Access denied", 403);
  }

  return success(challenge);
}

// PUT — update challenge
export async function PUT({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const challenge = await prisma.challenge.findUnique({ where: { id: params.id } });
  if (!challenge) return error("NOT_FOUND", "Challenge not found", 404);
  if (challenge.userId !== user.userId) return error("FORBIDDEN", "Not your challenge", 403);

  const body = await request.json();
  const updateData: any = {};
  if (body.title) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.theme) updateData.theme = body.theme;
  if (body.difficulty) updateData.difficulty = body.difficulty;
  if (body.iconEmoji !== undefined) updateData.iconEmoji = body.iconEmoji;
  if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
  if (body.status) updateData.status = body.status;

  const updated = await prisma.challenge.update({
    where: { id: params.id },
    data: updateData,
    include: { actions: { orderBy: { order: "asc" } } },
  });

  return success(updated);
}

// PATCH — restart a completed challenge (duplicate as new active)
export async function PATCH({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const challenge = await prisma.challenge.findUnique({
    where: { id: params.id },
    include: { actions: true },
  });
  if (!challenge) return error("NOT_FOUND", "Challenge not found", 404);
  if (challenge.userId !== user.userId) return error("FORBIDDEN", "Not your challenge", 403);

  const newChallenge = await prisma.challenge.create({
    data: {
      userId: user.userId,
      title: `${challenge.title} (Restarted)`,
      description: challenge.description,
      theme: challenge.theme,
      difficulty: challenge.difficulty,
      iconEmoji: challenge.iconEmoji,
      targetProgress: challenge.targetProgress,
      rewardXp: challenge.rewardXp,
      rewardCoins: challenge.rewardCoins,
      bossName: challenge.bossName,
      bossEmoji: challenge.bossEmoji,
      bossMaxHp: challenge.bossMaxHp,
      bossCurrentHp: challenge.bossMaxHp, // Reset HP to full
      bossType: challenge.bossType,
      lootTable: challenge.lootTable as any,
      actions: {
        create: challenge.actions.map((a, i) => ({
          title: a.title,
          description: a.description,
          iconEmoji: a.iconEmoji,
          progressValue: a.progressValue,
          order: i,
          linkedActionType: a.linkedActionType,
          isRepeatable: a.isRepeatable,
          maxRepeats: a.maxRepeats,
        })),
      },
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  return success(newChallenge);
}

// DELETE — archive challenge
export async function DELETE({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const challenge = await prisma.challenge.findUnique({ where: { id: params.id } });
  if (!challenge) return error("NOT_FOUND", "Challenge not found", 404);
  if (challenge.userId !== user.userId) return error("FORBIDDEN", "Not your challenge", 403);

  await prisma.challenge.update({
    where: { id: params.id },
    data: { status: "archived" },
  });

  return success(null);
}
