import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// NOTE: Full-text search requires running prisma/fts-setup.sql after seeding:
//   psql "$DATABASE_URL" -f prisma/fts-setup.sql
// Without this, note search falls back to slower ILIKE pattern matching.

async function main() {
  console.log('Seeding database...');

  // Quests — seeded idempotently by title, so re-running adds only new quests.
  const questDefs = [
    { title: 'Daily Scribe',     description: 'Write at least 1 note today',   questType: 'daily',  icon: 'scroll',  criteria: { action: 'create_note',  count: 1 },   xpReward: 20,  coinReward: 5 },
    { title: 'Word Weaver',      description: 'Write 500 words total today',    questType: 'daily',  icon: 'feather', criteria: { action: 'write_words',  count: 500 }, xpReward: 30,  coinReward: 10 },
    { title: 'Daily Login',      description: 'Log in to the tavern today',     questType: 'daily',  icon: 'door',    criteria: { action: 'daily_login',  count: 1 },   xpReward: 10,  coinReward: 5 },
    { title: 'Open Book',        description: 'Make 1 note public today',       questType: 'daily',  icon: 'share',   criteria: { action: 'make_public',  count: 1 },   xpReward: 15,  coinReward: 5 },
    { title: 'Prolific Author',  description: 'Create 10 notes this week',      questType: 'weekly', icon: 'books',   criteria: { action: 'create_note',  count: 10 },  xpReward: 100, coinReward: 50 },
    { title: 'Guild Founder',    description: 'Create or join a guild',         questType: 'weekly', icon: 'banner',  criteria: { action: 'join_guild',   count: 1 },   xpReward: 150, coinReward: 30 },
    { title: 'Knowledge Sharer', description: 'Make 3 notes public this week',  questType: 'weekly', icon: 'share',   criteria: { action: 'make_public',  count: 3 },   xpReward: 80,  coinReward: 25 },
    { title: 'Tavern Regular',   description: 'Log in 5 days this week',         questType: 'weekly', icon: 'fire',    criteria: { action: 'daily_login',  count: 5 },   xpReward: 80,  coinReward: 20 },
    { title: 'Public Library',   description: 'Make 10 notes public this week',  questType: 'weekly', icon: 'share',   criteria: { action: 'make_public',  count: 10 },  xpReward: 120, coinReward: 40 },
    { title: 'AI Scribe',        description: 'Use AI to summarize 1 note today', questType: 'daily',  icon: 'sparkle', criteria: { action: 'ai_summarize', count: 1 },   xpReward: 20,  coinReward: 5 },
  ];

  let newQuests = 0;
  for (const def of questDefs) {
    const exists = await prisma.quest.findFirst({ where: { title: def.title }, select: { id: true } });
    if (!exists) { await prisma.quest.create({ data: def }); newQuests++; }
  }
  const quests = await prisma.quest.findMany({ select: { id: true } });

  // Cosmetic items (only when none exist yet)
  const items = (await prisma.cosmeticItem.count()) > 0 ? [] : await Promise.all([
    prisma.cosmeticItem.create({
      data: {
        name: 'Scholar Quill',
        description: 'A fine quill for the learned scribe',
        type: 'badge',
        coinCost: 50,
        rarity: 'common',
      },
    }),
    prisma.cosmeticItem.create({
      data: {
        name: 'Golden Frame',
        description: 'A gilded frame for your avatar',
        type: 'avatar_frame',
        coinCost: 100,
        rarity: 'rare',
      },
    }),
    prisma.cosmeticItem.create({
      data: {
        name: 'Obsidian Theme',
        description: 'Dark and elegant tavern theme',
        type: 'theme',
        coinCost: 200,
        rarity: 'epic',
      },
    }),
    prisma.cosmeticItem.create({
      data: {
        name: 'Emerald Ink',
        description: 'Vibrant green ink for your name',
        type: 'name_color',
        coinCost: 75,
        rarity: 'uncommon',
      },
    }),
    prisma.cosmeticItem.create({
      data: {
        name: 'Ancient Map',
        description: 'A weathered map border for your profile',
        type: 'avatar_frame',
        coinCost: 150,
        rarity: 'rare',
      },
    }),
  ]);

  // Achievements — seeded idempotently by title
  const achievementDefs = [
    { title: 'First Scroll',     description: 'Create your first note',   icon: 'scroll',  criteria: { action: 'create_note',  count: 1 },     xpReward: 50 },
    { title: 'Scribe Apprentice',description: 'Create 50 notes',           icon: 'book',    criteria: { action: 'create_note',  count: 50 },    xpReward: 200 },
    { title: 'Streak Master',    description: '7-day login streak',        icon: 'fire',    criteria: { action: 'daily_login',  count: 7 },     xpReward: 100 },
    { title: 'Wordsmith',        description: 'Write 10,000 words total',  icon: 'pen',     criteria: { action: 'write_words',  count: 10000 }, xpReward: 300 },
    { title: 'Guild Leader',     description: 'Create a guild',            icon: 'crown',   criteria: { action: 'create_guild', count: 1 },     xpReward: 150 },
    { title: 'Quest Champion',   description: 'Complete 30 quests',        icon: 'trophy',  criteria: { action: 'complete_quest', count: 30 }, xpReward: 250 },
    { title: 'AI Scholar',       description: 'Use AI to summarize your first note', icon: 'sparkle', criteria: { action: 'ai_summarize', count: 1 }, xpReward: 50 },
  ];

  let newAchievements = 0;
  for (const def of achievementDefs) {
    const exists = await prisma.achievement.findFirst({ where: { title: def.title }, select: { id: true } });
    if (!exists) { await prisma.achievement.create({ data: def }); newAchievements++; }
  }

  console.log(`Seeded: +${newQuests} new quests (${quests.length} total), ${items.length} new items, +${newAchievements} new achievements`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
