import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

async function main() {
  const email = "guild.demo@tavernotex.dev";
  const password = "demo123456";
  const passwordHash = await bcrypt.hash(password, 10);

  let user = await p.user.findUnique({ where: { email } });
  if (!user) {
    user = await p.user.create({
      data: {
        email, username: "guildmaster", passwordHash,
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
  const items = await p.cosmeticItem.findMany({ take: 15 });
  for (const item of items) {
    await p.userInventory.upsert({
      where: { userId_cosmeticItemId: { userId: user.id, cosmeticItemId: item.id } },
      create: { userId: user.id, cosmeticItemId: item.id },
      update: {},
    });
  }
  console.log("Granted", items.length, "shop items");

  // Create a sample guild
  const existingGuild = await p.guild.findFirst({
    where: { ownerId: user.id },
  });
  if (!existingGuild) {
    const guild = await p.guild.create({
      data: {
        name: "The Golden Tankard",
        description: "A gathering place for brave adventurers. Share tales, complete quests, earn glory!",
        isPublic: true,
        inviteCode: "golden01",
        ownerId: user.id,
        maxMembers: 50,
      },
    });

    await p.guildRole.createMany({
      data: [
        { guildId: guild.id, name: "Owner", color: "#FFD700", permissions: "all", position: 100 },
        { guildId: guild.id, name: "Admin", color: "#EF4444", permissions: "manage_messages,kick_members,manage_tasks", position: 80 },
        { guildId: guild.id, name: "Moderator", color: "#3B82F6", permissions: "manage_messages,kick_members", position: 40 },
        { guildId: guild.id, name: "Officer", color: "#10B981", permissions: "manage_tasks", position: 20 },
        { guildId: guild.id, name: "Member", color: "#6B7280", permissions: "", position: 0 },
      ],
    });

    const ownerRole = await p.guildRole.findUnique({
      where: { guildId_name: { guildId: guild.id, name: "Owner" } },
    });

    await p.guildMember.create({
      data: { guildId: guild.id, userId: user.id, roleId: ownerRole!.id },
    });

    console.log("Created guild:", guild.name, "| invite:", guild.inviteCode);
  } else {
    console.log("Guild already exists:", existingGuild.name);
  }

  await p.$disconnect();
  console.log("\nLogin: guild.demo@tavernotex.dev / demo123456");
}

main().catch(e => { console.error(e); process.exit(1); });
