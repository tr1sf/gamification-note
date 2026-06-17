import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });
const u = await p.user.update({ where: { username: "uniqename1" }, data: { role: "admin" } });
console.log("Done! Role:", u.role);
await p.$disconnect();
