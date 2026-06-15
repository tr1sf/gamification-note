import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const bosses = await prisma.challenge.findMany({
    where: {
      userId: user.userId,
      status: "active",
      bossType: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return success(bosses);
}
