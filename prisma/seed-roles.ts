import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const PRESET_ROLES = [
  { name: "Owner", color: "#FFD700", permissions: "all", position: 100 },
  { name: "Admin", color: "#EF4444", permissions: "manage_messages,kick_members,manage_tasks", position: 80 },
  { name: "Moderator", color: "#3B82F6", permissions: "manage_messages,kick_members", position: 40 },
  { name: "Officer", color: "#10B981", permissions: "manage_tasks", position: 20 },
  { name: "Member", color: "#6B7280", permissions: "", position: 0 },
];

async function main() {
  const guilds = await prisma.guild.findMany();
  for (const guild of guilds) {
    // Create preset roles for each guild
    for (const preset of PRESET_ROLES) {
      await prisma.guildRole.upsert({
        where: { guildId_name: { guildId: guild.id, name: preset.name } },
        create: { guildId: guild.id, ...preset },
        update: {},
      });
    }

    // Migrate existing members
    const members = await prisma.guildMember.findMany({ where: { guildId: guild.id } });
    for (const member of members) {
      const roleName = member.role === "owner" ? "Owner" : member.role === "admin" ? "Admin" : "Member";
      const role = await prisma.guildRole.findUnique({
        where: { guildId_name: { guildId: guild.id, name: roleName } },
      });
      if (role) {
        await prisma.guildMember.update({
          where: { id: member.id },
          data: { roleId: role.id },
        });
      }
    }
    console.log(`Migrated guild: ${guild.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
