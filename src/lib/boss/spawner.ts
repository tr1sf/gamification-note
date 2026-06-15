import { prisma } from "~/lib/db";

const DAILY_BOSS_NAMES = [
  { name: "Shadow Procrastinator", emoji: "👻" },
  { name: "Ink Blotter", emoji: "🖋️" },
  { name: "Dust Mite", emoji: "🐛" },
  { name: "Blank Page Specter", emoji: "📄" },
  { name: "Fog Wraith", emoji: "🌫️" },
];

const WEEKLY_BOSS_NAMES = [
  { name: "Knowledge Wyrm", emoji: "🐉" },
  { name: "Procrastination Hydra", emoji: "🐍" },
  { name: "The Great Blank", emoji: "🌑" },
  { name: "Void Colossus", emoji: "🗿" },
];

export async function spawnDailyBoss(
  userId: string,
  level: number
): Promise<string | null> {
  // One daily boss per calendar day, regardless of completion status
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const existing = await prisma.challenge.findFirst({
    where: {
      userId,
      bossType: "daily",
      createdAt: { gte: todayStart, lt: todayEnd },
    },
  });
  if (existing) return existing.id;

  const boss =
    DAILY_BOSS_NAMES[Math.floor(Math.random() * DAILY_BOSS_NAMES.length)];
  const hp = 50 + level * 10;
  const challenge = await prisma.challenge.create({
    data: {
      userId,
      title: `Daily Boss: ${boss.name}`,
      description:
        "Defeat this daily minion by writing notes and completing quizzes!",
      theme: "growth",
      difficulty: "easy",
      iconEmoji: boss.emoji,
      bossName: boss.name,
      bossEmoji: boss.emoji,
      bossMaxHp: hp,
      bossCurrentHp: hp,
      bossType: "daily",
      targetProgress: 100,
      rewardXp: 20,
      rewardCoins: 10,
    },
  });
  return challenge.id;
}

export async function spawnWeeklyBoss(
  userId: string,
  level: number
): Promise<string | null> {
  const now = new Date();
  const mondayStart = new Date(now);
  mondayStart.setDate(
    now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)
  );
  mondayStart.setHours(0, 0, 0, 0);

  const existing = await prisma.challenge.findFirst({
    where: { userId, bossType: "weekly", createdAt: { gte: mondayStart } },
  });
  if (existing) return existing.id;

  const boss =
    WEEKLY_BOSS_NAMES[Math.floor(Math.random() * WEEKLY_BOSS_NAMES.length)];
  const hp = 200 + level * 50;
  const challenge = await prisma.challenge.create({
    data: {
      userId,
      title: `Weekly Boss: ${boss.name}`,
      description:
        "A powerful foe appears! Use all your skills this week to bring it down!",
      theme: "journey",
      difficulty: "medium",
      iconEmoji: boss.emoji,
      bossName: boss.name,
      bossEmoji: boss.emoji,
      bossMaxHp: hp,
      bossCurrentHp: hp,
      bossType: "weekly",
      targetProgress: 100,
      rewardXp: 100,
      rewardCoins: 30,
      lootTable: [
        { itemType: "coins", dropChance: 0.7, amount: 30 },
        { itemType: "consumable", dropChance: 0.2, name: "XP Booster (1h)" },
        { itemType: "badge", dropChance: 0.08 },
        { itemType: "frame", dropChance: 0.02 },
      ],
    },
  });
  return challenge.id;
}
