import { prisma } from "~/lib/db";
import { createNotification } from "~/lib/socket/notifications";

/**
 * Check if a notification type is enabled in the user's preferences.
 * Defaults to `true` (enabled) if the pref is not set.
 */
function prefEnabled(prefs: Record<string, unknown> | null, key: string): boolean {
  if (!prefs) return true;
  const val = prefs[key];
  return val !== false; // Only false explicitly disables
}

export async function runNudgeEngine(userId: string): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  const [user, todayNotes, lastNote, guildMember] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { streak: true, xp: true, level: true, notificationPrefs: true } }),
    prisma.note.count({ where: { userId, isDeleted: false, createdAt: { gte: todayStart } } }),
    prisma.note.findFirst({ where: { userId, isDeleted: false }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.guildMember.findFirst({ where: { userId }, include: { guild: { include: { tasks: { where: { status: "assigned" }, take: 1 } } } } }),
  ]);
  if (!user) return;

  // Parse notification preferences so each nudge can check before firing.
  const prefs = user.notificationPrefs as Record<string, unknown> | null;

  const daysSinceLastNote = lastNote ? Math.ceil((now.getTime() - lastNote.createdAt.getTime()) / 86400000) : 999;

  // 1. Streak at risk (after 21:00, no note today, streak >= 3)
  if (prefEnabled(prefs, "streak_warning") && user.streak >= 3 && todayNotes === 0 && now.getHours() >= 21) {
    await createNotification(userId, "streak_warning", `⚡ Còn 3h để giữ streak ${user.streak} ngày!`, "Viết 1 note ngay!", { urgency: "urgent" }).catch(() => {});
  }

  // 2. Comeback (gone 2 days — Nelar voice)
  if (prefEnabled(prefs, "comeback") && daysSinceLastNote >= 2 && daysSinceLastNote < 7) {
    await createNotification(userId, "comeback", "Nelar misses you...", "It's been 2 days since your last scroll. The tavern feels empty.", { urgency: "urgent", mascot: "nelar", mascotState: "worried" }).catch(() => {});
  }

  // 3. Near milestone (100, 200, 300...)
  const totalNotes = await prisma.note.count({ where: { userId, isDeleted: false } });
  const nextMilestone = Math.ceil(totalNotes / 100) * 100;
  if (nextMilestone - totalNotes <= 5 && totalNotes >= 95) {
    await createNotification(userId, "milestone", `🎉 Sắp đạt ${nextMilestone} notes!`, `Còn ${nextMilestone - totalNotes} nữa!`, { urgency: "urgent" }).catch(() => {});
  }

  // 4. Weekly recap (Sunday between 20-21)
  if (prefEnabled(prefs, "weekly_recap") && now.getDay() === 0 && now.getHours() === 20) {
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const weekNotes = await prisma.note.count({ where: { userId, isDeleted: false, createdAt: { gte: weekStart } } });
    const wordsAgg = await prisma.note.aggregate({ where: { userId, isDeleted: false, createdAt: { gte: weekStart } }, _sum: { wordCount: true } });
    await createNotification(userId, "weekly_recap", "📊 Weekly Recap", `${weekNotes} notes, ${(wordsAgg._sum.wordCount ?? 0).toLocaleString()} words`, { urgency: "normal" }).catch(() => {});
  }

  // 5. Guild backlog
  if (prefEnabled(prefs, "guild_activity") && guildMember?.guild?.tasks?.length) {
    await createNotification(userId, "guild_activity", "🏛️ Guild task waiting!", "Your guild has pending tasks.", { urgency: "normal" }).catch(() => {});
  }

  // 6. Near level-up (less than 15% to next level)
  const xpForNext = (user.level + 1) * (user.level + 1) * 100;
  const xpRemaining = xpForNext - user.xp;
  if (xpRemaining > 0 && xpRemaining / xpForNext <= 0.15) {
    await createNotification(userId, "level_up_near", `📈 Còn ${xpRemaining} XP lên Level ${user.level + 1}!`, "Tiếp tục viết để lên level!", { urgency: "urgent" }).catch(() => {});
  }
}
