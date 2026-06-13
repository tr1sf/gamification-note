import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

// POST — add an action to a challenge
export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const challenge = await prisma.challenge.findUnique({ where: { id: params.id } });
  if (!challenge) return error("NOT_FOUND", "Challenge not found", 404);
  if (challenge.userId !== user.userId) return error("FORBIDDEN", "Not your challenge", 403);

  const body = await request.json();
  if (!body.title) return error("VALIDATION_ERROR", "Action title required", 400);

  const maxOrder = await prisma.challengeAction.findFirst({
    where: { challengeId: params.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const action = await prisma.challengeAction.create({
    data: {
      challengeId: params.id,
      title: body.title,
      description: body.description || null,
      iconEmoji: body.iconEmoji || null,
      progressValue: body.progressValue || 10,
      order: (maxOrder?.order ?? -1) + 1,
      linkedActionType: body.linkedActionType || null,
      linkedTarget: body.linkedTarget || null,
      isRepeatable: body.isRepeatable || false,
      maxRepeats: body.maxRepeats || null,
    },
  });

  return success(action);
}
