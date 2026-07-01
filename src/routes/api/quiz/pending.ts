/**
 * Spaced Repetition Schedule
 *
 * Based on the Ebbinghaus Forgetting Curve (1885): memory retention decays
 * exponentially over time. Spaced retrieval at increasing intervals strengthens
 * long-term memory consolidation.
 *
 * Intervals: 0 (immediate), 3 days, 7 days, 30 days
 *
 * Reference implementations:
 * - SM-2 Algorithm (SuperMemo, Wozniak 1990): uses E-Factor to adjust intervals
 * - Leitner System (1972): 5-box flashcard method
 * - Duolingo (Settles & Meeder 2016): half-life regression for optimal review timing
 *
 * Our adaptive variant (personalized group) adjusts intervals based on accuracy:
 * - accuracy >= 85% → interval × 1.5 (can review less frequently)
 * - accuracy >= 60% → interval unchanged
 * - accuracy < 60% → interval × 0.6 (needs more frequent review)
 *
 * This is based on the "desirable difficulty" principle (Bjork 1994):
 * optimal learning occurs at ~70-80% success rate.
 */
import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { getRecommendedQuizzes, getExperimentGroup, getAdaptiveInterval } from "~/lib/ml/quiz-recommender";

const REVIEW_INTERVALS = [0, 3, 7, 30];

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const group = getExperimentGroup(user.userId);

  if (group === "personalized") {
    const recommended = await getRecommendedQuizzes(user.userId);
    if (recommended.length === 0) return success([]);
    const quizzes = await prisma.quiz.findMany({ where: { id: { in: recommended } } });
    const quizMap = new Map(quizzes.map(q => [q.id, q]));
    const ordered = recommended.map(id => quizMap.get(id)).filter(Boolean);
    return success(ordered);
  }

  // Control group: fixed intervals with adaptive adjustment based on
  // the user's last quiz accuracy. High accuracy → longer interval (less
  // frequent review); low accuracy → shorter interval (more frequent).
  // This implements the "desirable difficulty" principle (Bjork 1994).
    const quizzes = await prisma.quiz.findMany({
      where: { userId: user.userId, reviewCount: { lt: 4 } },
      orderBy: { lastReviewedAt: { sort: "asc", nulls: "first" } },
      include: { attempts: { orderBy: { completedAt: "desc" }, take: 1, select: { score: true } }, note: { select: { id: true, title: true } } },
    });

  const pending = quizzes.filter(q => {
    const baseInterval = REVIEW_INTERVALS[q.reviewCount] || 0;
    // Adjust interval based on last attempt accuracy.
    const lastScore = q.attempts?.[0]?.score ?? null;
    const adjustedInterval = getAdaptiveInterval(baseInterval, lastScore);
    const lastReview = q.lastReviewedAt || q.generatedAt;
    const nextReview = new Date(lastReview.getTime() + adjustedInterval * 86400000);
    return nextReview <= new Date();
  });

  return success(pending);
}
