import { prisma } from "~/lib/db";
import { success } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const theme = url.searchParams.get("theme");
  const difficulty = url.searchParams.get("difficulty");
  const take = Math.min(parseInt(url.searchParams.get("take") || "20"), 50);

  const challenges = await prisma.challenge.findMany({
    where: {
      isPublic: true,
      status: "completed",
      ...(theme ? { theme } : {}),
      ...(difficulty ? { difficulty } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take,
    include: { _count: { select: { actions: true } }, user: { select: { username: true, avatarUrl: true } } },
  });

  return success(challenges);
}
