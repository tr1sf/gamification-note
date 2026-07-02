import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";
import { hashPassword } from "~/lib/auth/password";

const accounts = [
  { email: "guild1@tavernotex.dev", username: "guildone", password: "demo123456", path: "professional" },
  { email: "guild2@tavernotex.dev", username: "guildtwo", password: "demo123456", path: "journaler" },
];

export async function GET() {
  try {
    const results = [];
    for (const acc of accounts) {
      const existing = await prisma.user.findFirst({ where: { email: acc.email }, select: { id: true } });
      if (existing) {
        // Update level
        await prisma.user.update({ where: { id: existing.id }, data: { xp: 5000, level: 15 } });
        results.push({ email: acc.email, action: "updated to level 15" });
      } else {
        // Create new user
        const hashed = await hashPassword(acc.password);
        const user = await prisma.user.create({
          data: {
            email: acc.email,
            username: acc.username,
            password: hashed,
            path: acc.path,
            xp: 5000,
            level: 15,
            coins: 500,
            streak: 7,
          },
        });
        results.push({ email: acc.email, username: acc.username, action: "created at level 15" });
      }
    }
    return success(results);
  } catch (e) {
    return error("SEED_ERROR", (e as Error).message, 500);
  }
}
