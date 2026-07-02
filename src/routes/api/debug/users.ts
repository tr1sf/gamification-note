import { prisma } from "~/lib/db";
import { success } from "~/lib/api-response";

export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true, xp: true, coins: true, level: true, path: true },
    orderBy: { xp: "desc" },
    take: 20,
  });
  return success({ total: users.length, users });
}
