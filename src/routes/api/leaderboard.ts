import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

const leaderboardCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60000;

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
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

  // Authz must run BEFORE the cache lookup, otherwise a non-member could read
  // a cached guild leaderboard (roster + XP).
  if (scope === "guild" && guildId) {
    const callerMembership = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: user.userId } },
      select: { userId: true },
    });
    if (!callerMembership) {
      return error("FORBIDDEN", "You are not a member of this guild", 403);
    }
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

  // Shape to what the UI expects: a `userId` field and a 1-based `rank`.
  const ranked = users.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    level: u.level,
    xp: u.xp,
    title: u.title,
  }));

  leaderboardCache.set(cacheKey, { data: ranked, timestamp: Date.now() });

  return success(ranked);
}
