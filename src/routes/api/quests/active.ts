import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const userQuests = await prisma.userQuest.findMany({
    where: { userId: user.userId, status: { in: ["active", "completed"] } },
    include: { quest: true },
    orderBy: { createdAt: "desc" },
  });

  return success(
    userQuests.map((uq) => ({
      userQuestId: uq.id,
      status: uq.status,
      progress: uq.progress,
      completedAt: uq.completedAt,
      quest: uq.quest,
    }))
  );
}
