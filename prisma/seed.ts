import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const existingQuests = await prisma.quest.count();
  if (existingQuests > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  // Daily quests
  const quests = await Promise.all([
    prisma.quest.create({
      data: {
        title: 'Daily Scribe',
        description: 'Write at least 1 note today',
        questType: 'daily',
        icon: 'scroll',
        criteria: { action: 'create_note', count: 1 },
        xpReward: 20,
        coinReward: 5,
      },
    }),
    prisma.quest.create({
      data: {
        title: 'Word Weaver',
        description: 'Write 500 words total today',
        questType: 'daily',
        icon: 'feather',
        criteria: { action: 'write_words', count: 500 },
        xpReward: 30,
        coinReward: 10,
      },
    }),
    prisma.quest.create({
      data: {
        title: 'Daily Login',
        description: 'Log in to the tavern today',
        questType: 'daily',
        icon: 'door',
        criteria: { action: 'daily_login', count: 1 },
        xpReward: 10,
        coinReward: 5,
      },
    }),
    prisma.quest.create({
      data: {
        title: 'Prolific Author',
        description: 'Create 10 notes this week',
        questType: 'weekly',
        icon: 'books',
        criteria: { action: 'create_note', count: 10 },
        xpReward: 100,
        coinReward: 50,
      },
    }),
    prisma.quest.create({
      data: {
        title: 'Guild Founder',
        description: 'Create or join a guild',
        questType: 'weekly',
        icon: 'banner',
        criteria: { action: 'join_guild', count: 1 },
        xpReward: 150,
        coinReward: 30,
      },
    }),
    prisma.quest.create({
      data: {
        title: 'Knowledge Sharer',
        description: 'Make 3 notes public this week',
        questType: 'weekly',
        icon: 'share',
        criteria: { action: 'make_public', count: 3 },
        xpReward: 80,
        coinReward: 25,
      },
    }),
  ]);

  // Cosmetic items
  const items = await Promise.all([
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

  // Achievements
  const achievements = await Promise.all([
    prisma.achievement.create({
      data: {
        title: 'First Scroll',
        description: 'Create your first note',
        icon: 'scroll',
        criteria: { action: 'create_note', count: 1 },
        xpReward: 50,
      },
    }),
    prisma.achievement.create({
      data: {
        title: 'Scribe Apprentice',
        description: 'Create 50 notes',
        icon: 'book',
        criteria: { action: 'create_note', count: 50 },
        xpReward: 200,
      },
    }),
    prisma.achievement.create({
      data: {
        title: 'Streak Master',
        description: '7-day login streak',
        icon: 'fire',
        criteria: { action: 'daily_login', count: 7 },
        xpReward: 100,
      },
    }),
    prisma.achievement.create({
      data: {
        title: 'Wordsmith',
        description: 'Write 10,000 words total',
        icon: 'pen',
        criteria: { action: 'write_words', count: 10000 },
        xpReward: 300,
      },
    }),
    prisma.achievement.create({
      data: {
        title: 'Guild Leader',
        description: 'Create a guild',
        icon: 'crown',
        criteria: { action: 'create_guild', count: 1 },
        xpReward: 150,
      },
    }),
    prisma.achievement.create({
      data: {
        title: 'Quest Champion',
        description: 'Complete 30 quests',
        icon: 'trophy',
        criteria: { action: 'complete_quest', count: 30 },
        xpReward: 250,
      },
    }),
  ]);

  console.log(`Seeded: ${quests.length} quests, ${items.length} items, ${achievements.length} achievements`);
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
