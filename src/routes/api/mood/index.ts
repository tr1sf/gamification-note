import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

const MOODS = ["😊", "😐", "😢", "😡", "😴", "🎉", "💪", "🧘"];

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 86400000);

  const logs = await prisma.auditLog.findMany({
    where: { userId: user.userId, actionType: "mood_checkin", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { metadata: true, createdAt: true },
  });

  return success(logs.map((l) => ({
    date: l.createdAt.toISOString().slice(0, 10),
    mood: (l.metadata as any)?.mood || "😊",
  })));
}

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const mood = body.mood as string;
  if (!MOODS.includes(mood)) return error("VALIDATION_ERROR", "Invalid mood", 400);

  const today = new Date().toISOString().slice(0, 10);
  const existing = await prisma.auditLog.findFirst({
    where: { userId: user.userId, actionType: "mood_checkin", createdAt: { gte: new Date(today) } },
  });
  if (existing) return error("ALREADY_CHECKED", "Already checked in today", 400);

  await prisma.auditLog.create({
    data: { userId: user.userId, actionType: "mood_checkin", xpChange: 0, coinChange: 0, metadata: { mood } },
  });

  return success({ mood, date: today });
}
