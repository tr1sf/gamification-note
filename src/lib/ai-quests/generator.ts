import type { Prisma } from "@prisma/client";
import { prisma } from "~/lib/db";

interface UserBehaviorProfile {
  lastActive: Date;
  daysSinceLastNote: number;
  avgNoteLength: number;
  notesThisWeek: number;
  notesThisMonth: number;
  favoriteTags: string[];
  streak: number;
  aiUsage: number;
  reviewCount: number;
  mostProductiveDay: string;
  mostProductiveHour: number;
}

export async function buildBehaviorProfile(userId: string): Promise<UserBehaviorProfile> {
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now); monthStart.setMonth(now.getMonth() - 1);

  const [lastNote, allNotes, auditLogs, user] = await Promise.all([
    prisma.note.findFirst({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, wordCount: true },
    }),
    prisma.note.findMany({
      where: { userId, isDeleted: false },
      select: { createdAt: true, wordCount: true, tags: true },
    }),
    prisma.auditLog.findMany({
      where: { userId, createdAt: { gte: monthStart } },
      select: { actionType: true, createdAt: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { streak: true } }),
  ]);

  const daysSinceLastNote = lastNote
    ? Math.ceil((now.getTime() - lastNote.createdAt.getTime()) / 86400000)
    : 999;
  const avgNoteLength = allNotes.length > 0
    ? Math.round(allNotes.reduce((s, n) => s + n.wordCount, 0) / allNotes.length)
    : 0;
  const notesThisWeek = allNotes.filter((n) => n.createdAt >= weekStart).length;
  const notesThisMonth = allNotes.filter((n) => n.createdAt >= monthStart).length;

  // Top tags
  const tagCounts = new Map<string, number>();
  for (const note of allNotes) {
    for (const tag of note.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  const favoriteTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const aiUsage = auditLogs.filter((l) => l.actionType === "ai_summarize").length;
  const reviewCount = auditLogs.filter((l) => l.actionType === "note_review").length;

  // Most productive day and hour
  const dayCounts = new Map<number, number>();
  const hourCounts = new Map<number, number>();
  for (const log of auditLogs) {
    if (log.actionType === "create_note") {
      const h = log.createdAt.getHours();
      hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
    }
  }
  for (const note of allNotes) {
    const day = note.createdAt.getDay();
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }
  let bestDayNum = 0; let bestDayCount = 0;
  for (const [day, count] of dayCounts) { if (count > bestDayCount) { bestDayNum = day; bestDayCount = count; } }
  let bestHour = 0; let bestHourCount = 0;
  for (const [hour, count] of hourCounts) { if (count > bestHourCount) { bestHour = hour; bestHourCount = count; } }
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    lastActive: lastNote?.createdAt ?? new Date(0),
    daysSinceLastNote,
    avgNoteLength,
    notesThisWeek,
    notesThisMonth,
    favoriteTags,
    streak: user?.streak ?? 0,
    aiUsage,
    reviewCount,
    mostProductiveDay: dayNames[bestDayNum],
    mostProductiveHour: bestHour,
  };
}

function getLevelMultiplier(level: number): { target: number; xpMult: number } {
  if (level <= 5) return { target: 1, xpMult: 1 };
  if (level <= 15) return { target: 2, xpMult: 2 };
  return { target: 3, xpMult: 3 };
}

const QUEST_RULES: Array<{
  id: string;
  condition: (profile: UserBehaviorProfile) => boolean;
  quest: (profile: UserBehaviorProfile) => {
    title: string; description: string; actionType: string; target: number;
    xpReward: number; coinReward: number;
  };
  reason: (profile: UserBehaviorProfile) => string;
}> = [
  {
    id: "warm-up",
    condition: (profile: UserBehaviorProfile) => profile.daysSinceLastNote > 2,
    quest: (profile: UserBehaviorProfile) => ({
      title: "Warm-up Writer",
      description: `You haven't written in ${profile.daysSinceLastNote} days. Write 1 short note to get back in rhythm!`,
      actionType: "create_note",
      target: 1,
      xpReward: 15,
      coinReward: 5,
    }),
    reason: (profile: UserBehaviorProfile) => `You've been away for a while — time to warm up!`,
  },
  {
    id: "summarizer",
    condition: (profile: UserBehaviorProfile) => profile.avgNoteLength > 800,
    quest: (profile: UserBehaviorProfile) => ({
      title: "Insight Miner",
      description: `Your notes average ${profile.avgNoteLength} words. Try AI summarizing 1 note!`,
      actionType: "ai_summarize",
      target: 1,
      xpReward: 20,
      coinReward: 5,
    }),
    reason: () => "Long notes benefit from AI-powered summaries.",
  },
  {
    id: "night-scholar",
    condition: (profile: UserBehaviorProfile) => profile.mostProductiveHour >= 19,
    quest: (profile: UserBehaviorProfile) => ({
      title: "Night Scholar",
      description: `You're most productive around ${profile.mostProductiveHour}:00. Create 1 note in your peak hour!`,
      actionType: "create_note",
      target: 1,
      xpReward: 10,
      coinReward: 3,
    }),
    reason: (profile: UserBehaviorProfile) => `You write best at ${profile.mostProductiveHour}:00 — leverage your peak time.`,
  },
  {
    id: "streak-saver",
    condition: (profile: UserBehaviorProfile) => profile.streak >= 5 && profile.daysSinceLastNote >= 1,
    quest: (profile: UserBehaviorProfile) => ({
      title: "Streak Keeper",
      description: `Your ${profile.streak}-day streak is at risk! Write 1 note today to keep it alive.`,
      actionType: "create_note",
      target: 1,
      xpReward: 10,
      coinReward: 3,
    }),
    reason: (profile: UserBehaviorProfile) => `Protect your ${profile.streak}-day streak!`,
  },
  {
    id: "ai-explorer",
    condition: (profile: UserBehaviorProfile) => profile.aiUsage < 3,
    quest: () => ({
      title: "AI Explorer",
      description: "You haven't tried AI summarization much. Give it a try on 1 note!",
      actionType: "ai_summarize",
      target: 1,
      xpReward: 20,
      coinReward: 5,
    }),
    reason: () => "AI can help you extract key insights from your notes.",
  },
  {
    id: "reviewer",
    condition: (profile: UserBehaviorProfile) => profile.reviewCount < 5 && profile.notesThisMonth > 10,
    quest: () => ({
      title: "Knowledge Keeper",
      description: "You've written a lot but rarely review. Open 1 old note today!",
      actionType: "review_note",
      target: 1,
      xpReward: 10,
      coinReward: 3,
    }),
    reason: () => "Reviewing old notes strengthens memory retention.",
  },
  {
    id: "sharer",
    condition: (profile: UserBehaviorProfile) => profile.notesThisMonth > 5,
    quest: () => ({
      title: "Knowledge Sharer",
      description: "You've been productive! Make 1 note public to share your knowledge.",
      actionType: "make_public",
      target: 1,
      xpReward: 15,
      coinReward: 5,
    }),
    reason: () => "Sharing knowledge benefits the whole community.",
  },
];

export async function generateQuests(userId: string): Promise<Array<{
  title: string; description: string; actionType: string; target: number;
  xpReward: number; coinReward: number; ruleId: string; source: string; reason: string;
}>> {
  const [profile, user] = await Promise.all([
    buildBehaviorProfile(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { level: true } }),
  ]);
  const mult = getLevelMultiplier(user?.level ?? 1);

  const recentCutoff = new Date(Date.now() - 86400000);
  const recentRuleIds = await prisma.aIQuest.findMany({
    where: {
      userId,
      ruleId: { not: null },
      createdAt: { gte: recentCutoff },
    },
    select: { ruleId: true },
  });
  const recentSet = new Set(recentRuleIds.map((r) => r.ruleId).filter(Boolean) as string[]);

  const results: Array<any> = [];

  for (const rule of QUEST_RULES) {
    if (results.length >= 3) break;
    if (recentSet.has(rule.id)) continue;
    try {
      if (rule.condition(profile)) {
        const q = rule.quest(profile);
        results.push({
          ...q,
          target: q.target * mult.target,
          xpReward: q.xpReward * mult.xpMult,
          ruleId: rule.id,
          source: "rule",
          reason: rule.reason(profile),
        });
      }
    } catch {}
  }

  return results;
}
