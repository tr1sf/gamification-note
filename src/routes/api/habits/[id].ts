import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { updateHabitSchema } from "~/validators/habit";

type RouteCtx = { request: Request; params: { id: string } };

async function ownHabit(habitId: string, userId: string) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId }, select: { userId: true } });
  return habit && habit.userId === userId ? habit : null;
}

// PATCH — edit a habit (title/description/icon/rewards/archive).
export async function PATCH({ request, params }: RouteCtx) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  if (!(await ownHabit(params.id, user.userId))) {
    return error("NOT_FOUND", "Habit not found", 404);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateHabitSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  const habit = await prisma.habit.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return success({ id: habit.id });
}

// DELETE — remove a habit (and its check-ins via cascade).
export async function DELETE({ request, params }: RouteCtx) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  if (!(await ownHabit(params.id, user.userId))) {
    return error("NOT_FOUND", "Habit not found", 404);
  }

  await prisma.habit.delete({ where: { id: params.id } });
  return success(null);
}
