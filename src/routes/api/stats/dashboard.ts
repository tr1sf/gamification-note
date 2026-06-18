import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

// Stored icon names (see prisma/seed.ts) → emoji for display.
const ACHIEVEMENT_ICONS: Record<string, string> = {
  scroll: "📜",
  book: "📖",
  books: "📚",
  fire: "🔥",
  pen: "🖊️",
  crown: "👑",
  trophy: "🏆",
  feather: "🪶",
  banner: "🚩",
  door: "🚪",
  share: "🔗",
};

// Cosmetic item type → emoji for display.
const ITEM_ICONS: Record<string, string> = {
  badge: "🎖️",
  avatar_frame: "🖼️",
  theme: "🎨",
  name_color: "🎨",
};

async function calculateStreak(userId: string): Promise<number> {
  const auditLogs = await prisma.auditLog.findMany({
    where: { userId, actionType: "daily_login" },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 365,
  });

  if (auditLogs.length === 0) return 0;

  const uniqueDates = new Set<string>();
  for (const log of auditLogs) {
    uniqueDates.add(log.createdAt.toISOString().slice(0, 10));
  }
  const dates = Array.from(uniqueDates).sort().reverse();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const current = new Date(dates[i - 1]);
    const prev = new Date(dates[i]);
    const diffDays = (current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (Math.abs(diffDays - 1) < 0.01) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const [
    userData,
    totalNotes,
    wordsResult,
    questsCompleted,
    allAchievements,
    userAchievements,
    inventory,
    streak,
    recentXP,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.userId },
      select: { level: true, xp: true, coins: true },
    }),
    prisma.note.count({
      where: { userId: user.userId, isDeleted: false },
    }),
    prisma.note.aggregate({
      where: { userId: user.userId, isDeleted: false },
      _sum: { wordCount: true },
    }),
    prisma.userQuest.count({
      where: { userId: user.userId, status: { in: ["completed", "claimed"] } },
    }),
    prisma.achievement.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, description: true, icon: true },
    }),
    prisma.userAchievement.findMany({
      where: { userId: user.userId },
      select: { achievementId: true, unlockedAt: true },
    }),
    prisma.userInventory.findMany({
      where: { userId: user.userId },
      orderBy: { purchasedAt: "desc" },
      select: {
        id: true,
        isEquipped: true,
        expiresAt: true,
        item: {
          select: { id: true, name: true, description: true, type: true, imageUrl: true, rarity: true, category: true },
        },
      },
    }),
    calculateStreak(user.userId),
    prisma.auditLog.findMany({
      where: { userId: user.userId, xpChange: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { actionType: true, xpChange: true, createdAt: true },
    }),
  ]);

  const totalWords = wordsResult._sum.wordCount ?? 0;

  const unlockedMap = new Map(
    userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt])
  );
  const achievementsUnlocked = userAchievements.filter((ua) => ua.unlockedAt !== null).length;

  const stats = [
    { label: "Scrolls Written", value: totalNotes, icon: "📜" },
    { label: "Total Words", value: totalWords.toLocaleString(), icon: "✍️" },
    { label: "Day Streak", value: streak, icon: "🔥" },
    { label: "Quests Done", value: questsCompleted, icon: "📋" },
    { label: "Achievements", value: achievementsUnlocked, icon: "🏆" },
    { label: "Coins", value: (userData?.coins ?? 0).toLocaleString(), icon: "🪙" },
  ];

  const achievements = allAchievements.map((a) => {
    const unlockedAt = unlockedMap.get(a.id) ?? null;
    return {
      id: a.id,
      title: a.title,
      description: a.description ?? "",
      icon: ACHIEVEMENT_ICONS[a.icon] ?? "🏆",
      unlocked: unlockedAt !== null,
      unlockedAt: unlockedAt ? unlockedAt.toISOString() : undefined,
    };
  });

  const inventoryItems = inventory.map((inv) => ({
    id: inv.item.id,
    inventoryId: inv.id,
    name: inv.item.name,
    description: inv.item.description ?? "",
    icon: inv.item.imageUrl || ITEM_ICONS[inv.item.type] || "🎁",
    itemType: inv.item.type,
    itemCategory: inv.item.category as { usageType?: string } | undefined,
    rarity: inv.item.rarity,
    equipped: inv.isEquipped,
    owned: true,
    expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
  }));

  return success({
    // ── Flat fields consumed by the Tavern Hall dashboard (tavern.tsx) ──
    totalNotes,
    totalWords,
    streak,
    questsCompleted,
    achievementsUnlocked,
    recentXP,
    // ── Structured fields consumed by the Profile page (profile.tsx) ──
    stats,
    achievements,
    inventory: inventoryItems,
  });
}
