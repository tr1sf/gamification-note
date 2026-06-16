import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { role: true } });
  if (dbUser?.role !== "admin") return error("FORBIDDEN", "Admin only", 403);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      level: true,
      xp: true,
      coins: true,
      streak: true,
      _count: { select: { notes: true, quizAttempts: true } },
    },
  });

  const correlations = {
    levelToNotes: 0,
    levelToQuizzes: 0,
    streakToNotes: 0,
    streakToQuizzes: 0,
  };

  if (users.length > 1) {
    const n = users.length;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
    for (const u of users) {
      const x = u.level;
      const y = u._count.notes;
      sx += x; sy += y; sxy += x * y; sx2 += x * x; sy2 += y * y;
    }
    const denom = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
    correlations.levelToNotes = denom > 0 ? Math.round(((n * sxy - sx * sy) / denom) * 1000) / 1000 : 0;

    sx = sy = sxy = sx2 = sy2 = 0;
    for (const u of users) {
      const x = u.level;
      const y = u._count.quizAttempts;
      sx += x; sy += y; sxy += x * y; sx2 += x * x; sy2 += y * y;
    }
    const denom2 = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
    correlations.levelToQuizzes = denom2 > 0 ? Math.round(((n * sxy - sx * sy) / denom2) * 1000) / 1000 : 0;

    sx = sy = sxy = sx2 = sy2 = 0;
    for (const u of users) {
      const x = u.streak;
      const y = u._count.notes;
      sx += x; sy += y; sxy += x * y; sx2 += x * x; sy2 += y * y;
    }
    const denom3 = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
    correlations.streakToNotes = denom3 > 0 ? Math.round(((n * sxy - sx * sy) / denom3) * 1000) / 1000 : 0;

    sx = sy = sxy = sx2 = sy2 = 0;
    for (const u of users) {
      const x = u.streak;
      const y = u._count.quizAttempts;
      sx += x; sy += y; sxy += x * y; sx2 += x * x; sy2 += y * y;
    }
    const denom4 = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
    correlations.streakToQuizzes = denom4 > 0 ? Math.round(((n * sxy - sx * sy) / denom4) * 1000) / 1000 : 0;
  }

  return success(correlations);
}
