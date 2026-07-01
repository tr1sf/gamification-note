import type { Prisma } from "@prisma/client";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(): Date {
  const d = startOfWeek();
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

async function rotateQuestType(
  tx: Prisma.TransactionClient,
  userId: string,
  questType: "daily" | "weekly" | "monthly",
  startOfPeriod: Date,
  endOfPeriod: Date
): Promise<void> {
  const existing = await tx.userQuest.findFirst({
    where: {
      userId,
      quest: { questType },
      createdAt: { gte: startOfPeriod, lte: endOfPeriod },
    },
    include: { quest: true },
  });

  if (existing) return;

  await tx.userQuest.updateMany({
    where: {
      userId,
      quest: { questType },
      status: "active",
    },
    data: { status: "expired" },
  });

  const availableQuests = await tx.quest.findMany({
    where: { questType, isActive: true },
  });

  // ── Adaptive quest selection ──
  // Instead of pure random, weight quests by the user's path and recent
  // activity gaps. This encourages diverse behavior: if a student hasn't
  // been quizzing, boost quiz quests; if a journaler hasn't written
  // reflectively, boost writing quests.

  // Fetch user's path for path-specific weighting.
  const userRow = await tx.user.findUnique({
    where: { id: userId },
    select: { path: true, gamificationStyle: true },
  });
  const path = userRow?.path ?? "student";
  const style = userRow?.gamificationStyle ?? "balanced";

  // Path-specific action boosts: quests with these criteria actions get
  // higher weight for this path (encourages the learning style).
  const PATH_BOOSTS: Record<string, string[]> = {
    student: ["ai_summarize", "create_note", "make_public"],   // learning focus
    professional: ["ai_summarize", "add_link", "make_public"],  // productivity
    journaler: ["create_note", "write_words", "structured_note"],  // reflection
  };
  const boostedActions = new Set(PATH_BOOSTS[path] ?? PATH_BOOSTS.student);

  // Style-specific action boosts.
  const STYLE_BOOSTS: Record<string, string[]> = {
    competitive: ["create_note", "make_public"],        // competition → publish more
    collaborative: ["make_public", "ai_summarize"],     // share knowledge
    solo: ["create_note", "write_words", "ai_summarize"],  // personal growth
    minimal: ["create_note"],                           // simplicity
    balanced: [],
  };
  const styleBoosts = new Set(STYLE_BOOSTS[style] ?? []);

  // Assign weights: base 1.0, +0.5 for path boost, +0.3 for style boost.
  const weighted = availableQuests.map((q) => {
    const criteria = q.criteria as Record<string, unknown>;
    const action = criteria.action as string;
    let weight = 1.0;
    if (boostedActions.has(action)) weight += 0.5;
    if (styleBoosts.has(action)) weight += 0.3;
    return { quest: q, weight };
  });

  // Weighted random selection (Fisher-Yates with weights).
  const selected: typeof availableQuests = [];
  const pool = [...weighted];
  const pickCount = Math.min(3, pool.length);
  for (let i = 0; i < pickCount; i++) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].weight;
      if (r <= 0) { idx = j; break; }
    }
    selected.push(pool[idx].quest);
    pool.splice(idx, 1);
  }

  for (const quest of selected) {
    await tx.userQuest.upsert({
      where: { userId_questId: { userId, questId: quest.id } },
      create: {
        userId,
        questId: quest.id,
        progress: { current: 0 },
        status: "active",
      },
      update: {
        progress: { current: 0 },
        status: "active",
        completedAt: null,
      },
    });
  }
}

/**
 * Rotate quests for the user. Returns true if AI quest generation is needed
 * (caller should invoke generateAiQuestsAfterCommit outside the transaction).
 */
export async function rotateQuestsIfNeeded(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<boolean> {
  await rotateQuestType(tx, userId, "daily", startOfToday(), endOfToday());
  await rotateQuestType(tx, userId, "weekly", startOfWeek(), endOfWeek());
  await rotateQuestType(tx, userId, "monthly", startOfMonth(), endOfMonth());

  const activeAiQuests = await tx.aIQuest.findFirst({
    where: { userId, status: "active" },
  });
  if (!activeAiQuests) {
    const lastGen = await tx.aIQuest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (!lastGen || (Date.now() - lastGen.createdAt.getTime()) > 86400000) {
      // Signal to caller: AI quest generation needed, but must happen OUTSIDE
      // this transaction to avoid holding a FOR UPDATE row lock during API call.
      return true;
    }
  }
  return false;
}

/**
 * Generate AI quests for a user. Must be called OUTSIDE any transaction
 * that holds a FOR UPDATE lock on the User row.
 */
export async function generateAiQuestsAfterCommit(userId: string): Promise<void> {
  const { generateQuests } = await import("~/lib/ai-quests/generator");
  const generated = await generateQuests(userId);
  // Use a separate transaction for the writes
  const { prisma } = await import("~/lib/db");
  for (const q of generated) {
    await prisma.aIQuest.create({
      data: {
        userId,
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
  }
}
