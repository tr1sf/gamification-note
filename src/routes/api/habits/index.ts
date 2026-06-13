import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { createHabitSchema } from "~/validators/habit";

function dayKey(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// GET — list the user's active habits, with derived check-in state.
export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const habits = await prisma.habit.findMany({
    where: { userId: user.userId, isArchived: false },
    orderBy: { createdAt: "asc" },
  });

  const today = todayKey();
  const yest = yesterdayKey();

  return success({
    items: habits.map((h) => {
      const last = dayKey(h.lastCompletedOn);
      const completedToday = last === today;
      // A stored streak only counts as "current" if the last check-in was today
      // or yesterday; otherwise the streak has lapsed and resets on next check-in.
      const currentStreak = last === today || last === yest ? h.streak : 0;
      return {
        id: h.id,
        title: h.title,
        description: h.description,
        icon: h.icon,
        xpReward: h.xpReward,
        coinReward: h.coinReward,
        bestStreak: h.bestStreak,
        currentStreak,
        completedToday,
        createdAt: h.createdAt,
      };
    }),
  });
}

// POST — create a habit.
export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json().catch(() => ({}));
  const parsed = createHabitSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  const habit = await prisma.habit.create({
    data: {
      userId: user.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      icon: parsed.data.icon || "✅",
      xpReward: parsed.data.xpReward ?? 10,
      coinReward: parsed.data.coinReward ?? 2,
    },
  });

  return success({
    id: habit.id,
    title: habit.title,
    description: habit.description,
    icon: habit.icon,
    xpReward: habit.xpReward,
    coinReward: habit.coinReward,
    bestStreak: 0,
    currentStreak: 0,
    completedToday: false,
    createdAt: habit.createdAt,
  });
}
