import { prisma } from "~/lib/db";
import { success } from "~/lib/api-response";

export async function GET() {
  const [totalUsers, totalNotes, totalQuizzes] = await Promise.all([
    prisma.user.count(),
    prisma.note.count({ where: { isDeleted: false } }),
    prisma.quiz.count(),
  ]);

  const quizAttemptsByDay = await prisma.quizAttempt.groupBy({
    by: ["completedAt"],
    _avg: { score: true },
    _count: { id: true },
    where: { completedAt: { gte: new Date(Date.now() - 30 * 86400000) } },
  });

  const data = quizAttemptsByDay.map((d) => ({
    date: d.completedAt.toISOString().slice(0, 10),
    avgScore: Math.round((d._avg.score ?? 0) * 100) / 100,
    attempts: d._count.id,
  }));

  return success({ totalUsers, totalNotes, totalQuizzes, quizData: data });
}
