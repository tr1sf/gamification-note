import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Upsert XP Catalyst item
  const item = await prisma.cosmeticItem.upsert({
    where: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    update: {},
    create: {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'XP Catalyst',
      description: 'Doubles your daily XP cap for 24 hours. Use wisely — this is rare and powerful.',
      type: 'consumable',
      rarity: 'rare',
      coinCost: 80,
      isActive: true,
      category: { usageType: 'xp_booster', durationHours: 24 },
    },
  });

  console.log('XP Catalyst seeded:', item.id, item.name);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
