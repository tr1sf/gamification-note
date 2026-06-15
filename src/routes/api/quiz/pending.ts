import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

const REVIEW_INTERVALS = [1, 3, 7, 30];

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const quizzes = await prisma.quiz.findMany({
    where: { userId: user.userId, reviewCount: { lt: 4 } },
    orderBy: { lastReviewedAt: { sort: "asc", nulls: "first" } },
  });

  const pending = quizzes.filter(q => {
    const interval = REVIEW_INTERVALS[q.reviewCount] || 0;
    const lastReview = q.lastReviewedAt || q.generatedAt;
    const nextReview = new Date(lastReview.getTime() + interval * 86400000);
    return nextReview <= new Date();
  });

  return success(pending);
}
