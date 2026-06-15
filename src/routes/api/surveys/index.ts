import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";
import { grantReward } from "~/lib/gamification/engine";

export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { createdAt: true } });
  const daysSince = dbUser?.createdAt
    ? Math.ceil((Date.now() - new Date(dbUser.createdAt).getTime()) / 86400000)
    : 0;

  const surveys = await prisma.survey.findMany({
    where: { isActive: true, triggerDaysAfterSignup: { lte: daysSince } },
    include: { responses: { where: { userId: user.userId }, select: { id: true } } },
  });

  const pending = surveys
    .filter(s => s.responses.length === 0)
    .map(s => ({ id: s.id, title: s.title, questions: s.questions }));

  return success(pending);
}

export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json();
  const { surveyId, answers, comments } = body;
  if (!surveyId || !answers) return error("VALIDATION_ERROR", "surveyId and answers required", 400);

  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) return error("NOT_FOUND", "Survey not found", 404);

  const questions = survey.questions as Array<{ type: string }>;
  const likertScores = answers.filter(
    (a: { answerScore?: number }, i: number) => questions[i]?.type === "likert" && a.answerScore,
  );
  const overallScore = likertScores.length > 0
    ? likertScores.reduce((s: number, a: { answerScore?: number }) => s + (a.answerScore || 0), 0) / likertScores.length
    : null;

  await prisma.surveyResponse.create({
    data: { surveyId, userId: user.userId, answers, overallScore, comments: comments || null },
  });

  grantReward({
    userId: user.userId,
    xp: 0,
    coins: 50,
    actionType: "survey_complete",
    metadata: { surveyId },
  }).catch(() => {});

  return success({ completed: true, coinsAwarded: 50 });
}
