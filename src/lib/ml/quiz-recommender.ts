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
  return m.predict(userId, quizId);
}

export async function getRecommendedQuizzes(userId: string): Promise<string[]> {
  const REVIEW_INTERVALS = [0, 3, 7, 30];
  const pending = await prisma.quiz.findMany({
    where: { userId, reviewCount: { lt: 4 } },
  });

  const due = pending.filter(q => {
    const interval = REVIEW_INTERVALS[q.reviewCount] || 0;
    const last = q.lastReviewedAt || q.generatedAt;
    return new Date(last.getTime() + interval * 86400000) <= new Date();
  });

  if (due.length === 0) return [];

  const m = await getModel();
  const scored = due.map(q => {
    const predDifficulty = m.predict(userId, q.id);
    const difficultyMatch = 1 - Math.abs(predDifficulty / 100 - 0.3);
    const daysSinceLast = (Date.now() - (q.lastReviewedAt || q.generatedAt).getTime()) / 86400000;
    const urgency = Math.min(10, daysSinceLast);
    return { quizId: q.id, priority: difficultyMatch * 0.7 + urgency / 10 * 0.3 };
  });

  return scored.sort((a, b) => b.priority - a.priority).map(s => s.quizId);
}

export function getAdaptiveInterval(baseDays: number, lastAccuracy: number | null): number {
  if (lastAccuracy === null) return baseDays;
  if (lastAccuracy >= 85) return Math.round(baseDays * 1.5);
  if (lastAccuracy >= 60) return baseDays;
  return Math.max(1, Math.round(baseDays * 0.6));
}

export function getExperimentGroup(userId: string): "control" | "personalized" {
  const hash = userId.split("").reduce((h, c) => h + c.charCodeAt(0), 0);
  return hash % 2 === 0 ? "control" : "personalized";
}
