import { prisma } from "~/lib/db";
import { createGuildSchema } from "~/validators/guild";
import { success, error } from "~/lib/api-response";
import { processAction, triggerActionNotifications } from "~/lib/gamification/engine";
import { getUserFromRequest } from "~/lib/auth/get-user";

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const take = Math.min(parseInt(url.searchParams.get("take") || "20"), 50);

  const guilds = await prisma.guild.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      name: true,
      description: true,
      iconUrl: true,
      maxMembers: true,
      isPublic: true,
      createdAt: true,
      _count: { select: { members: true } },
      owner: { select: { id: true, username: true } },
    },
  });

  const hasMore = guilds.length > take;
  if (hasMore) guilds.pop();

  return success({
    items: guilds,
    nextCursor: hasMore ? guilds[guilds.length - 1]?.id : null,
  });
}

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const parsed = createGuildSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  const inviteCode = Math.random().toString(36).slice(2, 10);
  let attempts = 0;
  let code = inviteCode;
  while (attempts < 10) {
    const existing = await prisma.guild.findUnique({ where: { inviteCode: code } });
    if (!existing) break;
    if (attempts >= 9) return error("INTERNAL_ERROR", "Could not generate unique invite code", 500);
    code = Math.random().toString(36).slice(2, 10);
    attempts++;
  }

  const guild = await prisma.guild.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      isPublic: parsed.data.isPublic,
      inviteCode: code,
      ownerId: user.userId,
      members: {
        create: {
          userId: user.userId,
          role: "owner",
        },
      },
    },
    include: {
      _count: { select: { members: true } },
    },
  });

  const result = await processAction({
    userId: user.userId,
    actionType: "create_guild",
    metadata: { guildId: guild.id },
  });
  triggerActionNotifications(user.userId, result);

  return success(guild);
}
