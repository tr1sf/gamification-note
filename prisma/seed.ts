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
    { title: 'Knowledge Keeper', description: 'Review 1 old note (>7 days)',     questType: 'daily',  icon: 'book',    criteria: { action: 'review_note',   count: 1 },   xpReward: 15,  coinReward: 3 },
    { title: 'Architect',        description: 'Create 5 structured notes',         questType: 'weekly', icon: 'layout',  criteria: { action: 'structured_note', count: 5 },  xpReward: 50,  coinReward: 15 },
    // Monthly quests — Phase G
    { title: 'Cartographer',     description: 'Create 20 notes this month',        questType: 'monthly', icon: 'map',     criteria: { action: 'create_note',   count: 20 },  xpReward: 200, coinReward: 50 },
    { title: 'Chronicler',       description: 'Write 10000 words this month',       questType: 'monthly', icon: 'scroll',  criteria: { action: 'write_words',   count: 10000 }, xpReward: 300, coinReward: 80 },
    { title: 'Archaeologist',    description: 'Review 15 old notes this month',     questType: 'monthly', icon: 'book',    criteria: { action: 'review_note',   count: 15 },  xpReward: 250, coinReward: 60 },
    { title: 'Scribe Weekly',    description: 'Review 5 old notes this week',     questType: 'weekly', icon: 'book',    criteria: { action: 'review_note',   count: 5 },   xpReward: 60,  coinReward: 15 },
    // Mechanic-based quests (Phase P2)
    { title: 'Speed Writer',     description: 'Write a note within 15 min of quest assignment', questType: 'daily', icon: 'clock', mechanic: 'time_limit', mechanicConfig: { timeWindowMinutes: 15 }, criteria: { action: 'create_note', count: 1 }, xpReward: 25, coinReward: 8 },
    { title: 'Streak Guardian',  description: 'Keep your streak alive today', questType: 'daily', icon: 'fire', mechanic: 'streak_guard', mechanicConfig: { minStreak: 1 }, criteria: { action: 'daily_login', count: 1 }, xpReward: 15, coinReward: 5 },
    { title: 'Night Owl Bonus',  description: 'Write a note between 21:00-24:00', questType: 'daily', icon: 'moon', mechanic: 'time_window', mechanicConfig: { startHour: 21, endHour: 24 }, criteria: { action: 'create_note', count: 1 }, xpReward: 20, coinReward: 8 },
    { title: 'Tag Explorer',     description: 'Use 5 different tags this week', questType: 'weekly', icon: 'tag', mechanic: 'tag_variety', mechanicConfig: {}, criteria: { action: 'any', count: 5 }, xpReward: 60, coinReward: 20 },
    { title: 'Quality Craftsman',description: 'Create 3 notes with structure score ≥ 7', questType: 'weekly', icon: 'star', mechanic: 'structure_score', mechanicConfig: { minScore: 7 }, criteria: { action: 'create_note', count: 3 }, xpReward: 80, coinReward: 25 },
    { title: 'Guild Chatter',    description: 'Send 5 messages in guild chat', questType: 'weekly', icon: 'chat', mechanic: 'social', mechanicConfig: {}, criteria: { action: 'guild_message', count: 5 }, xpReward: 40, coinReward: 15 },
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
    prisma.cosmeticItem.create({
      data: {
        name: 'XP Booster (1h)',
        description: 'Double XP for 1 hour',
        type: 'consumable',
        coinCost: 30,
        rarity: 'common',
        category: { usageType: 'xp_boost', durationMin: 60 },
      },
    }),
    prisma.cosmeticItem.create({
      data: {
        name: 'Focus Potion',
        description: 'Double word-count bonus for 30 min',
        type: 'consumable',
        coinCost: 20,
        rarity: 'common',
        category: { usageType: 'focus_potion', durationMin: 30 },
      },
    }),
    prisma.cosmeticItem.create({
      data: {
        name: 'Streak Freeze',
        description: 'Miss 1 day without breaking streak',
        type: 'consumable',
        coinCost: 50,
        rarity: 'rare',
        category: { usageType: 'streak_freeze' },
      },
    }),
    prisma.cosmeticItem.create({
      data: {
        name: 'Quest Reroll',
        description: 'Replace 1 active quest',
        type: 'consumable',
        coinCost: 15,
        rarity: 'common',
        category: { usageType: 'quest_reroll' },
      },
    }),
    prisma.cosmeticItem.create({
      data: {
        name: 'Loot Box',
        description: 'Random badge or effect',
        type: 'consumable',
        coinCost: 75,
        rarity: 'epic',
        category: { usageType: 'loot_box' },
      },
    }),
  ]);

  // Themes
  const themeDefs = [
    {
      name: "Tavern", description: "Classic medieval tavern — warm parchment tones", coinCost: 0, rarity: "common", isDefault: true,
      cssVariables: { "--color-bg": "26 26 46", "--color-bg-elevated": "45 45 63", "--color-text-primary": "240 230 211", "--color-text-secondary": "160 147 125", "--color-accent": "212 165 116", "--color-xp": "251 191 36", "--color-coin": "226 185 111" },
    },
    {
      name: "Scholar", description: "Bright academic theme", coinCost: 0, rarity: "common", isDefault: false,
      cssVariables: { "--color-bg": "250 248 242", "--color-bg-elevated": "255 255 255", "--color-text-primary": "30 41 59", "--color-text-secondary": "100 116 139", "--color-accent": "44 82 130", "--color-xp": "34 197 94", "--color-coin": "234 179 8" },
    },
    {
      name: "Journey", description: "Adventurer's path", coinCost: 50, rarity: "rare", isDefault: false,
      cssVariables: { "--color-bg": "13 27 42", "--color-bg-elevated": "27 40 56", "--color-text-primary": "224 225 221", "--color-text-secondary": "119 141 169", "--color-accent": "226 185 111", "--color-xp": "74 222 128", "--color-coin": "234 179 8" },
    },
    {
      name: "Night Owl", description: "Dark minimalist for late-night focus", coinCost: 50, rarity: "rare", isDefault: false,
      cssVariables: { "--color-bg": "15 15 35", "--color-bg-elevated": "30 30 58", "--color-text-primary": "226 232 240", "--color-text-secondary": "148 163 184", "--color-accent": "124 58 237", "--color-xp": "52 211 153", "--color-coin": "250 204 21" },
    },
    {
      name: "Forest", description: "Nature's tranquility", coinCost: 100, rarity: "epic", isDefault: false,
      cssVariables: { "--color-bg": "26 37 24", "--color-bg-elevated": "36 51 34", "--color-text-primary": "226 232 220", "--color-text-secondary": "132 169 140", "--color-accent": "74 222 128", "--color-xp": "163 230 53", "--color-coin": "234 179 8" },
    },
    {
      name: "Ember", description: "Fire and warmth", coinCost: 100, rarity: "epic", isDefault: false,
      cssVariables: { "--color-bg": "45 26 14", "--color-bg-elevated": "61 42 24", "--color-text-primary": "245 235 220", "--color-text-secondary": "180 150 120", "--color-accent": "249 115 22", "--color-xp": "251 191 36", "--color-coin": "250 204 21" },
    },
    {
      name: "Royal", description: "Regal purple and gold", coinCost: 200, rarity: "legendary", isDefault: false,
      cssVariables: { "--color-bg": "26 10 46", "--color-bg-elevated": "42 26 62", "--color-text-primary": "240 225 255", "--color-text-secondary": "160 140 200", "--color-accent": "251 191 36", "--color-xp": "168 85 247", "--color-coin": "250 204 21" },
    },
  ];

  let newThemes = 0;
  for (const def of themeDefs) {
    const exists = await prisma.theme.findFirst({ where: { name: def.name }, select: { id: true } });
    if (!exists) { await prisma.theme.create({ data: def as any }); newThemes++; }
  }

  // Grant default themes to a test user if one exists
  const testUser = await prisma.user.findFirst({ where: { username: "demo" }, select: { id: true } });
  if (testUser) {
    const defaults = await prisma.theme.findMany({ where: { isDefault: true } });
    for (const t of defaults) {
      await prisma.userTheme.upsert({
        where: { userId_themeId: { userId: testUser.id, themeId: t.id } },
        create: { userId: testUser.id, themeId: t.id },
        update: {},
      });
    }
  }

  console.log(`Seeded: +${newThemes} new themes`);

  // Achievements — seeded idempotently by title
  const achievementDefs = [
    { title: 'First Scroll',     description: 'Create your first note',   icon: 'scroll',  criteria: { action: 'create_note',  count: 1 },     xpReward: 50 },
    { title: 'Scribe Apprentice',description: 'Create 50 notes',           icon: 'book',    criteria: { action: 'create_note',  count: 50 },    xpReward: 200 },
    { title: 'Streak Master',    description: '7-day login streak',        icon: 'fire',    criteria: { action: 'daily_login',  count: 7 },     xpReward: 100 },
    { title: 'Wordsmith',        description: 'Write 10,000 words total',  icon: 'pen',     criteria: { action: 'write_words',  count: 10000 }, xpReward: 300 },
    { title: 'Guild Leader',     description: 'Create a guild',            icon: 'crown',   criteria: { action: 'create_guild', count: 1 },     xpReward: 150 },
    { title: 'Quest Champion',   description: 'Complete 30 quests',        icon: 'trophy',  criteria: { action: 'complete_quest', count: 30 }, xpReward: 250 },
    { title: 'AI Scholar',       description: 'Use AI to summarize your first note', icon: 'sparkle', criteria: { action: 'ai_summarize', count: 1 }, xpReward: 50 },
    { title: 'Historian',        description: 'Review 50 old notes',                icon: 'book',    criteria: { action: 'review_note',   count: 50 }, xpReward: 100 },
    { title: 'Builder',          description: 'Create 100 structured notes',        icon: 'layout',  criteria: { action: 'structured_note', count: 100 }, xpReward: 200 },
    { title: 'Ambassador',       description: 'Get 10 views on shared notes',       icon: 'share',   criteria: { action: 'share_note',   count: 10 }, xpReward: 150 },
  ];

  let newAchievements = 0;
  for (const def of achievementDefs) {
    const exists = await prisma.achievement.findFirst({ where: { title: def.title }, select: { id: true } });
    if (!exists) { await prisma.achievement.create({ data: def }); newAchievements++; }
  }

  console.log(`Seeded: +${newQuests} new quests (${quests.length} total), ${items.length} new items, +${newAchievements} new achievements`);

  // Challenge Templates
  const templateDefs = [
    {
      title: "Learn React",
      description: "Master React fundamentals step by step",
      theme: "growth",
      difficulty: "medium",
      iconEmoji: "🌱",
      targetProgress: 100,
      rewardXp: 150,
      rewardCoins: 30,
      defaultActions: [
        { title: "Read React docs", description: "Official React tutorial", iconEmoji: "📖", progressValue: 20, linkedActionType: null },
        { title: "Build a component", description: "Create your first component", iconEmoji: "⚛️", progressValue: 25, linkedActionType: "create_note" },
        { title: "Style with CSS", description: "Add TailwindCSS styles", iconEmoji: "🎨", progressValue: 15, linkedActionType: null },
        { title: "Add state management", description: "Implement useState/context", iconEmoji: "🔄", progressValue: 20, linkedActionType: null },
        { title: "Deploy your app", description: "Deploy to production", iconEmoji: "🚀", progressValue: 20, linkedActionType: null },
      ],
    },
    {
      title: "Write a Thesis Chapter",
      description: "Complete one chapter of your thesis",
      theme: "scholar",
      difficulty: "hard",
      iconEmoji: "📚",
      targetProgress: 100,
      rewardXp: 250,
      rewardCoins: 50,
      defaultActions: [
        { title: "Research outline", description: "Create chapter outline", iconEmoji: "📝", progressValue: 15, linkedActionType: "create_note" },
        { title: "Literature review", description: "Review 5 papers", iconEmoji: "🔍", progressValue: 20, linkedActionType: "review_note" },
        { title: "First draft", description: "Write 1000 words", iconEmoji: "✍️", progressValue: 30, linkedActionType: "create_note" },
        { title: "Revise & edit", description: "Review and improve", iconEmoji: "📐", progressValue: 20, linkedActionType: "review_note" },
        { title: "Final polish", description: "Proofread and format", iconEmoji: "✅", progressValue: 15, linkedActionType: null },
      ],
    },
    {
      title: "30-Day Writing Habit",
      description: "Build a daily writing habit for a month",
      theme: "journey",
      difficulty: "epic",
      iconEmoji: "🧭",
      targetProgress: 300,
      rewardXp: 500,
      rewardCoins: 100,
      defaultActions: [
        { title: "Daily writing", description: "Write every day", iconEmoji: "📜", progressValue: 10, linkedActionType: "create_note", isRepeatable: true, maxRepeats: 30 },
      ],
    },
    {
      title: "Knowledge Organizer",
      description: "Organize and structure your notes",
      theme: "museum",
      difficulty: "easy",
      iconEmoji: "🏛️",
      targetProgress: 100,
      rewardXp: 80,
      rewardCoins: 15,
      defaultActions: [
        { title: "Add tags to 5 notes", description: "Categorize your knowledge", iconEmoji: "🏷️", progressValue: 25, linkedActionType: null },
        { title: "Create 3 structured notes", description: "Use headings and lists", iconEmoji: "📐", progressValue: 25, linkedActionType: "create_note" },
        { title: "Review 5 old notes", description: "Refresh your memory", iconEmoji: "🔍", progressValue: 25, linkedActionType: "review_note" },
        { title: "AI summarize 2 notes", description: "Extract key insights", iconEmoji: "✨", progressValue: 25, linkedActionType: "ai_summarize" },
      ],
    },
    {
      title: "Share Your Knowledge",
      description: "Make your notes public and help others",
      theme: "star",
      difficulty: "easy",
      iconEmoji: "⭐",
      targetProgress: 100,
      rewardXp: 100,
      rewardCoins: 20,
      defaultActions: [
        { title: "Make 3 notes public", description: "Share with the world", iconEmoji: "🌍", progressValue: 34, linkedActionType: "make_public" },
        { title: "Share a link", description: "Share with a friend", iconEmoji: "🔗", progressValue: 33, linkedActionType: null },
        { title: "Get a view", description: "Someone reads your note", iconEmoji: "👁️", progressValue: 33, linkedActionType: null },
      ],
    },
    {
      title: "Study Session",
      description: "A focused study block",
      theme: "scholar",
      difficulty: "medium",
      iconEmoji: "📖",
      targetProgress: 100,
      rewardXp: 120,
      rewardCoins: 25,
      defaultActions: [
        { title: "Create study notes", description: "Take notes on the topic", iconEmoji: "📝", progressValue: 30, linkedActionType: "create_note" },
        { title: "Review topic", description: "Review yesterday's notes", iconEmoji: "🔍", progressValue: 25, linkedActionType: "review_note" },
        { title: "Practice exercise", description: "Apply your knowledge", iconEmoji: "✏️", progressValue: 25, linkedActionType: null },
        { title: "Summarize with AI", description: "Get AI key points", iconEmoji: "✨", progressValue: 20, linkedActionType: "ai_summarize" },
      ],
    },
    {
      title: "Portfolio Project",
      description: "Build a complete project from scratch",
      theme: "puzzle",
      difficulty: "hard",
      iconEmoji: "🧩",
      targetProgress: 100,
      rewardXp: 300,
      rewardCoins: 60,
      defaultActions: [
        { title: "Plan architecture", description: "Design the system", iconEmoji: "📋", progressValue: 15, linkedActionType: "create_note" },
        { title: "Set up project", description: "Initialize the codebase", iconEmoji: "⚙️", progressValue: 15, linkedActionType: null },
        { title: "Build core features", description: "Implement main functionality", iconEmoji: "🔨", progressValue: 35, linkedActionType: "create_note" },
        { title: "Write documentation", description: "Document your work", iconEmoji: "📄", progressValue: 20, linkedActionType: "create_note" },
        { title: "Polish & deploy", description: "Final touches", iconEmoji: "🚀", progressValue: 15, linkedActionType: null },
      ],
    },
    {
      title: "Mindfulness Practice",
      description: "Build a daily mindfulness routine",
      theme: "growth",
      difficulty: "easy",
      iconEmoji: "🧘",
      targetProgress: 70,
      rewardXp: 80,
      rewardCoins: 15,
      defaultActions: [
        { title: "Morning reflection", description: "Write a short journal entry", iconEmoji: "🌅", progressValue: 25, linkedActionType: "create_note", isRepeatable: true, maxRepeats: 7 },
        { title: "Gratitude note", description: "Write what you're grateful for", iconEmoji: "🙏", progressValue: 25, linkedActionType: "create_note", isRepeatable: true, maxRepeats: 7 },
        { title: "Review progress", description: "Look back at your journey", iconEmoji: "📊", progressValue: 20, linkedActionType: "review_note" },
      ],
    },
    {
      title: "Language Learning Sprint",
      description: "Intensive language learning week",
      theme: "journey",
      difficulty: "medium",
      iconEmoji: "🗣️",
      targetProgress: 150,
      rewardXp: 180,
      rewardCoins: 35,
      defaultActions: [
        { title: "Learn vocabulary", description: "Study 20 new words", iconEmoji: "📝", progressValue: 15, linkedActionType: "create_note", isRepeatable: true, maxRepeats: 7 },
        { title: "Practice writing", description: "Write a short paragraph", iconEmoji: "✍️", progressValue: 20, linkedActionType: "create_note", isRepeatable: true, maxRepeats: 5 },
        { title: "Review past notes", description: "Review language notes", iconEmoji: "🔍", progressValue: 15, linkedActionType: "review_note", isRepeatable: true, maxRepeats: 3 },
      ],
    },
    {
      title: "Weekly Review Routine",
      description: "Build a habit of weekly reflection",
      theme: "star",
      difficulty: "easy",
      iconEmoji: "📊",
      targetProgress: 400,
      rewardXp: 200,
      rewardCoins: 40,
      defaultActions: [
        { title: "Week in review", description: "Summarize your week", iconEmoji: "📋", progressValue: 10, linkedActionType: "create_note", isRepeatable: true, maxRepeats: 52 },
      ],
    },
  ];

  let newTemplates = 0;
  for (const def of templateDefs) {
    const exists = await prisma.challengeTemplate.findFirst({ where: { title: def.title }, select: { id: true } });
    if (!exists) {
      await prisma.challengeTemplate.create({ data: def as any });
      newTemplates++;
    }
  }

  console.log(`Seeded: +${newTemplates} new challenge templates`);

  // ── Quest chains (Phase P2) ────────────────────────────────────────────────

  // Chain 1: Path of Scribe — Daily Scribe → Apprentice Writer
  const dailyScribeId = (await prisma.quest.findFirst({ where: { title: 'Daily Scribe' }, select: { id: true } }))?.id;
  if (dailyScribeId) {
    const apprentice = await prisma.quest.findFirst({ where: { title: 'Apprentice Writer' }, select: { id: true } });
    if (!apprentice) {
      await prisma.quest.create({ data: { title: 'Apprentice Writer', description: 'Chain step 2: Create 10 notes', questType: 'weekly', icon: 'scroll', narrativeText: 'The quill grows heavier with ink. You are no longer a novice.', mechanic: 'counter', unlockQuestId: dailyScribeId, criteria: { action: 'create_note', count: 10 }, xpReward: 80, coinReward: 25 } });
    } else {
      await prisma.quest.update({ where: { id: apprentice.id }, data: { unlockQuestId: dailyScribeId, narrativeText: 'The quill grows heavier with ink. You are no longer a novice.' } });
    }
  }

  // Chain 2: Wisdom Seeker — Knowledge Keeper → Insight Miner → Sage's Archive
  const knowledgeKeeperId = (await prisma.quest.findFirst({ where: { title: 'Knowledge Keeper' }, select: { id: true } }))?.id;
  if (knowledgeKeeperId) {
    let insightMiner = await prisma.quest.findFirst({ where: { title: 'Insight Miner' }, select: { id: true } });
    if (!insightMiner) {
      insightMiner = await prisma.quest.create({ data: { title: 'Insight Miner', description: 'Chain step 2: Review 10 old notes', questType: 'weekly', icon: 'gem', narrativeText: 'The deeper you dig, the brighter the gems.', mechanic: 'counter', unlockQuestId: knowledgeKeeperId, criteria: { action: 'review_note', count: 10 }, xpReward: 100, coinReward: 30 } });
    } else {
      await prisma.quest.update({ where: { id: insightMiner.id }, data: { unlockQuestId: knowledgeKeeperId } });
    }
    const sageArchive = await prisma.quest.findFirst({ where: { title: "Sage's Archive" }, select: { id: true } });
    if (!sageArchive) {
      await prisma.quest.create({ data: { title: "Sage's Archive", description: 'Chain step 3: Review 25 old notes', questType: 'monthly', icon: 'library', narrativeText: 'You have become a keeper of lost knowledge.', mechanic: 'counter', unlockQuestId: insightMiner.id, criteria: { action: 'review_note', count: 25 }, xpReward: 250, coinReward: 80 } });
    } else {
      await prisma.quest.update({ where: { id: sageArchive.id }, data: { unlockQuestId: insightMiner.id, narrativeText: 'You have become a keeper of lost knowledge.' } });
    }
  }

  // Chain 3: Community Builder — Guild Founder → Guild Leader
  const guildFounderId = (await prisma.quest.findFirst({ where: { title: 'Guild Founder' }, select: { id: true } }))?.id;
  if (guildFounderId) {
    const guildLeader = await prisma.quest.findFirst({ where: { title: 'Guild Leader' }, select: { id: true } });
    if (!guildLeader) {
      await prisma.quest.create({ data: { title: 'Guild Leader', description: 'Chain step 2: Send 20 messages in guild chat', questType: 'weekly', icon: 'crown', narrativeText: 'A true leader speaks and others listen.', mechanic: 'social', unlockQuestId: guildFounderId, criteria: { action: 'guild_message', count: 20 }, xpReward: 150, coinReward: 50 } });
    } else {
      await prisma.quest.update({ where: { id: guildLeader.id }, data: { unlockQuestId: guildFounderId, narrativeText: 'A true leader speaks and others listen.' } });
    }
  }

  console.log('Quest chains seeded.');
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
