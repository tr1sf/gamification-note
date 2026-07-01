import { prisma } from "~/lib/db";
import { SVD } from "./svd";

let model: SVD | null = null;
let lastTrained = 0;

export async function getModel(): Promise<SVD> {
  const now = Date.now();
  if (model && (now - lastTrained) < 30 * 60 * 1000) return model;

  const attempts = await prisma.quizAttempt.findMany({
    select: { userId: true, quizId: true, score: true },
    take: 5000,
  });

  model = new SVD({ factors: 8, epochs: 40 });
  if (attempts.length >= 10) model.train(attempts);
  lastTrained = now;
  return model;
}

export async function predictDifficulty(userId: string, quizId: string): Promise<number> {
  const m = await getModel();
  // Cold-start fallback: if the model has no data for this user/quiz (common
  // for new users or quizzes with <10 attempts), fall back to the quiz's
  // average score from all attempts. If no attempts exist, return 50 (medium).
  const hasUser = (m as any).userFactors?.has(userId);
  const hasQuiz = (m as any).quizFactors?.has(quizId);
  if (!hasUser || !hasQuiz) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { avgScore: true, reviewCount: true },
    });
    if (quiz?.avgScore != null && quiz.avgScore > 0) {
      // Predicted difficulty = 100 - avgScore (low avg score = hard quiz).
      return Math.max(0, Math.min(100, Math.round(100 - quiz.avgScore)));
    }
    return 50; // Neutral difficulty when no data at all.
  }
  return m.predict(userId, quizId);
}

export async function getRecommendedQuizzes(userId: string): Promise<string[]> {
  const REVIEW_INTERVALS = [0, 3, 7, 30];
  const group = getExperimentGroup(userId);

  const pending = await prisma.quiz.findMany({
    where: { userId, reviewCount: { lt: 4 } },
  });

  const due = pending.filter(q => {
    const interval = REVIEW_INTERVALS[q.reviewCount] || 0;
    const last = q.lastReviewedAt || q.generatedAt;
    return new Date(last.getTime() + interval * 86400000) <= new Date();
  });

  if (due.length === 0) return [];

  // Control group: basic sort by oldest-first (no SVD personalization)
  if (group === "control") {
    return due
      .sort((a, b) => (a.lastReviewedAt || a.generatedAt).getTime() - (b.lastReviewedAt || b.generatedAt).getTime())
      .map(q => q.id);
  }

  // Personalized group: SVD-based priority scoring
  const m = await getModel();
  const scored = due.map(q => {
    const predDifficulty = m.predict(userId, q.id);
    const difficultyMatch = 1 - Math.abs(predDifficulty / 100 - 0.3);
    const daysSinceLast = (Date.now() - (q.lastReviewedAt || q.generatedAt).getTime()) / 86400000;
    const urgency = Math.min(10, daysSinceLast);
    // Use adaptive interval based on Bjork's desirable difficulty principle
    const baseInterval = REVIEW_INTERVALS[q.reviewCount] || 0;
    const adaptiveInterval = getAdaptiveInterval(baseInterval, q.avgScore);
    const intervalWeight = baseInterval > 0 ? adaptiveInterval / baseInterval : 1;
    return { quizId: q.id, priority: difficultyMatch * 0.7 + urgency / 10 * 0.3 + (intervalWeight > 1 ? 0.1 : -0.1) };
  });

  return scored.sort((a, b) => b.priority - a.priority).map(s => s.quizId);
}

/**
 * Adaptive interval adjustment based on the "desirable difficulty" principle
 * (Bjork 1994). Optimal learning occurs at ~70-80% success rate.
 *
 * - accuracy >= 85% → interval × 1.5 (less frequent review needed)
 * - accuracy >= 60% → interval unchanged
 * - accuracy < 60% → interval × 0.6 (more frequent review needed)
 */
export function getAdaptiveInterval(baseDays: number, lastAccuracy: number | null): number {
  if (lastAccuracy === null) return baseDays;
  if (lastAccuracy >= 85) return Math.round(baseDays * 1.5);
  if (lastAccuracy >= 60) return baseDays;
  return Math.max(1, Math.round(baseDays * 0.6));
}

export function getExperimentGroup(userId: string): "control" | "personalized" {
  // FNV-1a hash for consistent group assignment (matches evaluation script)
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash % 2 === 0 ? "control" : "personalized";
}
