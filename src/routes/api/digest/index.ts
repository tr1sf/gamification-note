import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { isAiAvailable, getClient, SUMMARIZE_MODEL } from "~/lib/ai/openai";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { path: true } });
  if (dbUser?.path !== "professional") return error("FORBIDDEN", "Professional path only", 403);
  if (!isAiAvailable()) return error("AI_NOT_CONFIGURED", "AI not configured", 400);

  const yesterday = new Date(Date.now() - 86400000);
  yesterday.setHours(0, 0, 0, 0);

  const [recentNotes, activeQuests] = await Promise.all([
    prisma.note.findMany({
      where: { userId: user.userId, isDeleted: false, createdAt: { gte: yesterday } },
      orderBy: { createdAt: "desc" },
      select: { title: true, content: true, wordCount: true },
      take: 10,
    }),
    prisma.userQuest.findMany({
      where: { userId: user.userId, status: "active" },
      include: { quest: { select: { title: true } } },
      take: 5,
    }),
  ]);

  const notesText = recentNotes.map((n) => `- ${n.title} (${n.wordCount} words)`).join("\n");
  const questsText = activeQuests.map((q) => `- ${q.quest.title}`).join("\n");
  const prompt = `You are a daily productivity assistant. Create a brief morning digest in the SAME LANGUAGE as the user's notes.

Yesterday's activity:
${notesText || "No notes written"}
Active quests:
${questsText || "No active quests"}

Write a motivating 3-4 line digest including:
1. Yesterday's summary
2. Suggested focus for today
3. A quick productivity tip
Keep it positive and concise.`;

  const client = getClient();
  const response = await client.chat.completions.create({
    model: SUMMARIZE_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.5,
  });

  const digest = response.choices[0]?.message?.content || "Welcome back! Ready for a productive day.";
  return success({ digest, notesCount: recentNotes.length, questsCount: activeQuests.length });
}
