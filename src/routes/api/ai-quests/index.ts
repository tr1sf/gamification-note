import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { generateQuests } from "~/lib/ai-quests/generator";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const quests = await prisma.aIQuest.findMany({
    where: { userId: user.userId, status: "active" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return success(quests);
}

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  // Expire old active quests
  await prisma.aIQuest.updateMany({
    where: { userId: user.userId, status: "active" },
    data: { status: "expired" },
  });

  // Generate new quests
  const generated = await generateQuests(user.userId);

  const created = [];
  for (const q of generated) {
    const quest = await prisma.aIQuest.create({
      data: {
        userId: user.userId,
        title: q.title,
        description: q.description,
        actionType: q.actionType,
        target: q.target,
        xpReward: q.xpReward,
        coinReward: q.coinReward,
        source: q.source,
        ruleId: q.ruleId,
        reason: q.reason,
      },
    });
    created.push(quest);
  }

  return success(created);
}
