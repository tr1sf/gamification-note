import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const template = await prisma.challengeTemplate.findUnique({ where: { id: params.id } });
  if (!template) return error("NOT_FOUND", "Template not found", 404);

  const rawActions = template.defaultActions;
  if (!Array.isArray(rawActions)) {
    return error("INVALID_TEMPLATE", "Template has invalid defaultActions format", 500);
  }
  const actions = rawActions.filter(
    (a: any) => a && typeof a.title === "string" && a.title.length > 0
  ) as Array<{
    title: string; description?: string; iconEmoji?: string; progressValue?: number;
    linkedActionType?: string; isRepeatable?: boolean; maxRepeats?: number;
  }>;

  const challenge = await prisma.$transaction(async (tx) => {
    await tx.challengeTemplate.update({
      where: { id: params.id },
      data: { usageCount: { increment: 1 } },
    });

    const created = await tx.challenge.create({
      data: {
        userId: user.userId,
        title: template.title,
        description: template.description,
        theme: template.theme,
        difficulty: template.difficulty,
        iconEmoji: template.iconEmoji,
        targetProgress: template.targetProgress,
        rewardXp: template.rewardXp,
        rewardCoins: template.rewardCoins,
        actions: actions?.length > 0
          ? {
              create: actions.map((a, i) => ({
                title: a.title,
                description: a.description || null,
                iconEmoji: a.iconEmoji || null,
                progressValue: a.progressValue || 10,
                order: i,
                linkedActionType: a.linkedActionType || null,
                isRepeatable: a.isRepeatable || false,
                maxRepeats: a.maxRepeats || null,
              })),
            }
          : undefined,
      },
      include: { actions: { orderBy: { order: "asc" } } },
    });

    return created;
  });

  return success(challenge);
}
