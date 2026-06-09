import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = (request as any).locals?.user;
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const quests = await prisma.quest.findMany({
    where: { isActive: true, questType: { in: ["daily", "weekly"] } },
    orderBy: { questType: "asc" },
  });

  const userQuests = await prisma.userQuest.findMany({
    where: { userId: user.userId, status: { in: ["active", "completed"] } },
  });

  const userQuestMap = new Map(userQuests.map((uq) => [uq.questId, uq]));

  const enriched = quests.map((q) => {
    const uq = userQuestMap.get(q.id);
    return {
      ...q,
      userProgress: uq
        ? {
            status: uq.status,
            progress: uq.progress,
            completedAt: uq.completedAt,
            userQuestId: uq.id,
          }
        : null,
    };
  });

  return success(enriched);
}
