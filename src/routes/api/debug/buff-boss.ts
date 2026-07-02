import { prisma } from "~/lib/db";
import { success, error } from "~/lib/api-response";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: "bossdemo@tavernotex.dev" },
      select: { id: true, email: true, username: true, xp: true, coins: true, level: true },
    });
    if (!user) return error("NOT_FOUND", "User not found", 404);

    // Level 10 = sqrt(xp/50) >= 10 => xp >= 5000
    const targetXp = 5000;
    const targetLevel = 10;

    await prisma.user.update({
      where: { id: user.id },
      data: { xp: targetXp, level: targetLevel },
    });

    return success({
      email: user.email,
      username: user.username,
      before: { xp: user.xp, level: user.level },
      after: { xp: targetXp, level: targetLevel },
    });
  } catch (e) {
    return error("UPDATE_FAILED", (e as Error).message, 500);
  }
}
