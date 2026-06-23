import { prisma } from "~/lib/db";
import { getRandomAbility, getRegenAmount } from "./abilities";

const DAILY_BOSS_NAMES = [
  { name: "Shadow Procrastinator", emoji: "👻", image: "/assets/images/bosses/shadow-procrastinator.png" },
  { name: "Ink Blotter", emoji: "🖋️", image: "/assets/images/bosses/ink-blotter.png" },
  { name: "Dust Mite", emoji: "🐛", image: "/assets/images/bosses/dust-mite.png" },
  { name: "Blank Page Specter", emoji: "📄", image: "/assets/images/bosses/blank-page-specter.png" },
  { name: "Fog Wraith", emoji: "🌫️", image: "/assets/images/bosses/fog-wraith.png" },
];

const WEEKLY_BOSS_NAMES = [
  { name: "Knowledge Wyrm", emoji: "🐉", image: "/assets/images/bosses/knowledge_wyrm.png" },
  { name: "Procrastination Hydra", emoji: "🐍", image: "/assets/images/bosses/procrastination_hydra.png" },
  { name: "The Great Blank", emoji: "🌑", image: "/assets/images/bosses/great_blank.png" },
  { name: "Void Colossus", emoji: "🗿", image: "/assets/images/bosses/void_colossus.png" },
];

export async function spawnDailyBoss(
  userId: string,
  level: number
): Promise<string | null> {
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
  if (existing) {
    // Apply regen if boss has regen ability and it's a new day
    if (existing.bossAbility && (existing.bossAbility as any).type === "regen") {
      const regen = getRegenAmount(existing.bossAbility as any, existing.bossMaxHp ?? 100, existing.bossCurrentHp ?? 0);
      if (regen > 0 && existing.bossCurrentHp! > 0) {
        const newHp = Math.min(existing.bossMaxHp!, existing.bossCurrentHp! + regen);
        await prisma.challenge.update({
          where: { id: existing.id },
          data: { bossCurrentHp: newHp },
        });
      }
    }
    return existing.id;
  }

  const boss = DAILY_BOSS_NAMES[Math.floor(Math.random() * DAILY_BOSS_NAMES.length)];
  const ability = getRandomAbility("daily");
  const hp = 40 + level * 8;
  const challenge = await prisma.challenge.create({
    data: {
      userId,
      title: `Daily Boss: ${boss.name}`,
      description: `Defeat this daily minion by writing notes and completing quizzes!\nAbility: ${ability.icon} ${ability.name} — ${ability.description}`,
      theme: "growth",
      difficulty: "easy",
      iconEmoji: boss.emoji,
      bossName: boss.name,
      bossEmoji: boss.emoji,
      bossMaxHp: hp,
      bossCurrentHp: hp,
      bossType: "daily",
      bossAbility: ability as any,
      targetProgress: 100,
      rewardXp: 20,
      rewardCoins: 10,
      iconImageUrl: boss.image || null,
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

  const boss = WEEKLY_BOSS_NAMES[Math.floor(Math.random() * WEEKLY_BOSS_NAMES.length)];
  const ability = getRandomAbility("weekly");
  const hp = 100 + level * 20;
  const challenge = await prisma.challenge.create({
    data: {
      userId,
      title: `Weekly Boss: ${boss.name}`,
      description: `A powerful foe appears! Use all your skills this week to bring it down!\nAbility: ${ability.icon} ${ability.name} — ${ability.description}`,
      theme: "journey",
      difficulty: "medium",
      iconEmoji: boss.emoji,
      bossName: boss.name,
      bossEmoji: boss.emoji,
      bossMaxHp: hp,
      bossCurrentHp: hp,
      bossType: "weekly",
      bossAbility: ability as any,
      targetProgress: 100,
      rewardXp: 100,
      rewardCoins: 30,
      iconImageUrl: boss.image || null,
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
