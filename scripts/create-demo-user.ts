import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

async function main() {
  const email = "demo20@tavernotex.dev";
  const password = "demo123456";
  const passwordHash = await bcrypt.hash(password, 10);

  let user = await p.user.findUnique({ where: { email } });
  if (!user) {
    user = await p.user.create({
      data: {
        email, username: "demolv20", passwordHash,
        level: 25, xp: 62500, coins: 5000, streak: 30,
        role: "admin", path: "student",
        onboardingCompleted: true, gamificationStyle: "competitive",
      },
    });
    console.log("Created:", user.username, "Lv", user.level, "| XP:", user.xp, "| Coins:", user.coins);
  } else {
    await p.user.update({
      where: { email },
      data: { level: 25, xp: 62500, coins: 5000, streak: 30 },
    });
    console.log("Updated:", user.username, "Lv 25");
  }

  // Grant all themes
  const themes = await p.theme.findMany();
  for (const t of themes) {
    await p.userTheme.upsert({
      where: { userId_themeId: { userId: user.id, themeId: t.id } },
      create: { userId: user.id, themeId: t.id },
      update: {},
    });
  }
  console.log("Granted", themes.length, "themes");

  // Grant shop items
  const items = await p.cosmeticItem.findMany({ take: 10 });
  for (const item of items) {
    await p.userInventory.upsert({
      where: { userId_cosmeticItemId: { userId: user.id, cosmeticItemId: item.id } },
      create: { userId: user.id, cosmeticItemId: item.id },
      update: {},
    });
  }
  console.log("Granted", items.length, "shop items");

  await p.$disconnect();
  console.log("\nLogin: demo20@tavernotex.dev / demo123456");
}

main().catch(e => { console.error(e); process.exit(1); });
