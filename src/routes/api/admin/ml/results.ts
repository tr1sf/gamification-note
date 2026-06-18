import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { getExperimentGroup } from "~/lib/ml/quiz-recommender";

interface Metric {
  label: string;
  control: string;
  personalized: string;
  delta: string;
  significant: boolean;
}

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { role: true } });
  if (dbUser?.role !== "admin") return error("FORBIDDEN", "Admin only", 403);

  const attempts = await prisma.quizAttempt.findMany({
    select: { userId: true, quizId: true, score: true, completedAt: true },
    orderBy: { completedAt: "asc" },
  });

  const userAttempts = new Map<string, Array<{ quizId: string; score: number }>>();
  for (const a of attempts) {
    if (!userAttempts.has(a.userId)) userAttempts.set(a.userId, []);
    userAttempts.get(a.userId)!.push({ quizId: a.quizId, score: a.score });
  }

  let controlTotal = 0, controlCount = 0, personalizedTotal = 0, personalizedCount = 0;
  let controlImprovement = 0, controlImpCount = 0, personalizedImprovement = 0, personalizedImpCount = 0;

  for (const [userId, ua] of userAttempts) {
    const group = getExperimentGroup(userId);
    const avgScore = ua.reduce((s, a) => s + a.score, 0) / ua.length;
    const quizScores = new Map<string, number[]>();
    for (const a of ua) {
      if (!quizScores.has(a.quizId)) quizScores.set(a.quizId, []);
      quizScores.get(a.quizId)!.push(a.score);
    }
    let impSum = 0, impCount = 0;
    for (const [, scores] of quizScores) {
      if (scores.length >= 2) { impSum += scores[scores.length - 1] - scores[0]; impCount++; }
    }

    if (group === "control") {
      controlTotal += avgScore; controlCount++;
      controlImprovement += impSum; controlImpCount += impCount;
    } else {
      personalizedTotal += avgScore; personalizedCount++;
      personalizedImprovement += impSum; personalizedImpCount += impCount;
    }
  }

  const metrics: Metric[] = [
    {
      label: "Avg Quiz Score",
      control: controlCount > 0 ? Math.round(controlTotal / controlCount) + "%" : "-",
      personalized: personalizedCount > 0 ? Math.round(personalizedTotal / personalizedCount) + "%" : "-",
      delta: controlCount > 0 && personalizedCount > 0 ? Math.round(personalizedTotal / personalizedCount - controlTotal / controlCount) + "%" : "-",
      significant: controlCount > 5 && personalizedCount > 5,
    },
    {
      label: "Accuracy Improvement",
      control: controlImpCount > 0 ? "+" + Math.round(controlImprovement / controlImpCount) + "%" : "-",
      personalized: personalizedImpCount > 0 ? "+" + Math.round(personalizedImprovement / personalizedImpCount) + "%" : "-",
      delta: controlImpCount > 0 && personalizedImpCount > 0 ? Math.round(personalizedImprovement / personalizedImpCount - controlImprovement / controlImpCount) + "%" : "-",
      significant: controlImpCount > 5 && personalizedImpCount > 5,
    },
    {
      label: "Total Users",
      control: String(controlCount),
      personalized: String(personalizedCount),
      delta: "-",
      significant: false,
    },
  ];

  return success({ metrics });
}
