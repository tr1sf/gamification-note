import { prisma } from "~/lib/db";
import { createNotification } from "~/lib/socket/notifications";

export async function runNudgeEngine(userId: string): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  const [user, todayNotes, lastNote, guildMember] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { streak: true, xp: true, level: true } }),
    prisma.note.count({ where: { userId, isDeleted: false, createdAt: { gte: todayStart } } }),
    prisma.note.findFirst({ where: { userId, isDeleted: false }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.guildMember.findFirst({ where: { userId }, include: { guild: { include: { tasks: { where: { status: "assigned" }, take: 1 } } } } }),
  ]);
  if (!user) return;

  const daysSinceLastNote = lastNote ? Math.ceil((now.getTime() - lastNote.createdAt.getTime()) / 86400000) : 999;

  // 1. Streak at risk (after 21:00, no note today, streak >= 3)
  if (user.streak >= 3 && todayNotes === 0 && now.getHours() >= 21) {
    await createNotification(userId, "streak_warning", `⚡ Còn 3h để giữ streak ${user.streak} ngày!`, "Viết 1 note ngay!", { urgency: "urgent" }).catch(() => {});
  }

  // 2. Comeback (gone 3 days)
  if (daysSinceLastNote >= 3 && daysSinceLastNote < 7) {
    await createNotification(userId, "comeback", "👋 Đã 3 ngày không ghé tavern!", "Quay lại nhận quest mới!", { urgency: "normal" }).catch(() => {});
  }

  // 3. Near milestone (100, 200, 300...)
  const totalNotes = await prisma.note.count({ where: { userId, isDeleted: false } });
  const nextMilestone = Math.ceil(totalNotes / 100) * 100;
  if (nextMilestone - totalNotes <= 5 && totalNotes >= 95) {
    await createNotification(userId, "milestone", `🎉 Sắp đạt ${nextMilestone} notes!`, `Còn ${nextMilestone - totalNotes} nữa!`, { urgency: "urgent" }).catch(() => {});
  }

  // 4. Weekly recap (Sunday between 20-21)
  if (now.getDay() === 0 && now.getHours() === 20) {
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const weekNotes = await prisma.note.count({ where: { userId, isDeleted: false, createdAt: { gte: weekStart } } });
    const wordsAgg = await prisma.note.aggregate({ where: { userId, isDeleted: false, createdAt: { gte: weekStart } }, _sum: { wordCount: true } });
    await createNotification(userId, "weekly_recap", "📊 Weekly Recap", `${weekNotes} notes, ${(wordsAgg._sum.wordCount ?? 0).toLocaleString()} words`, { urgency: "normal" }).catch(() => {});
  }

  // 5. Guild backlog
  if (guildMember?.guild?.tasks?.length) {
    await createNotification(userId, "guild_activity", "🏛️ Guild task waiting!", "Your guild has pending tasks.", { urgency: "normal" }).catch(() => {});
  }

  // 6. Near level-up (less than 15% to next level)
  const xpForNext = (user.level + 1) * (user.level + 1) * 100;
  const xpRemaining = xpForNext - user.xp;
  if (xpRemaining > 0 && xpRemaining / xpForNext <= 0.15) {
    await createNotification(userId, "level_up_near", `📈 Còn ${xpRemaining} XP lên Level ${user.level + 1}!`, "Tiếp tục viết để lên level!", { urgency: "urgent" }).catch(() => {});
  }
}
