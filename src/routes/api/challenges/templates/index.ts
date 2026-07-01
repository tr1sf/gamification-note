import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function GET() {
  const templates = await prisma.challengeTemplate.findMany({
    where: { isActive: true },
    orderBy: { usageCount: "desc" },
    take: 20,
  });
  return success(templates);
}

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const { title, description, theme, difficulty, iconEmoji, targetProgress, rewardXp, rewardCoins, defaultActions } = body;

  if (!title || typeof title !== "string" || title.length < 2 || title.length > 100) {
    return error("VALIDATION_ERROR", "Title must be 2-100 characters", 400);
  }

  if (defaultActions && !Array.isArray(defaultActions)) {
    return error("VALIDATION_ERROR", "defaultActions must be an array", 400);
  }

  const template = await prisma.challengeTemplate.create({
    data: {
      title,
      description: description || "",
      theme: theme || "growth",
      difficulty: difficulty || "medium",
      iconEmoji: iconEmoji || null,
      targetProgress: targetProgress || 100,
      rewardXp: rewardXp || 50,
      rewardCoins: rewardCoins || 10,
      defaultActions: defaultActions || [],
    },
  });

  return success(template);
}
