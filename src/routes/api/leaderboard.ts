import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

const leaderboardCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60000;

export async function GET({ request }: { request: Request }) {
  const user = (request as any).locals?.user;
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") || "global";
  const guildId = url.searchParams.get("guildId");

  if (scope !== "global" && scope !== "guild") {
    return error("VALIDATION_ERROR", "scope must be 'global' or 'guild'", 400);
  }

  if (scope === "guild" && !guildId) {
    return error("VALIDATION_ERROR", "guildId is required for guild scope", 400);
  }

  const cacheKey = scope === "global" ? "global" : `guild:${guildId}`;
  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return success(cached.data);
  }

  let userIds: string[] | undefined;
  if (scope === "guild" && guildId) {
    const members = await prisma.guildMember.findMany({
      where: { guildId },
      select: { userId: true },
    });
    userIds = members.map((m) => m.userId);
    if (userIds.length === 0) {
      const result: unknown[] = [];
      leaderboardCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return success(result);
    }
  }

  const users = await prisma.user.findMany({
    where: userIds ? { id: { in: userIds } } : { xp: { gt: 0 } },
    orderBy: { xp: "desc" },
    take: 100,
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      level: true,
      xp: true,
      title: true,
    },
  });

  leaderboardCache.set(cacheKey, { data: users, timestamp: Date.now() });

  return success(users);
}
