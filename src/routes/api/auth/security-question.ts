import { prisma } from "~/lib/db";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { hashPassword } from "~/lib/auth/jwt";
import { securityQuestionSchema } from "~/validators/auth";
import { normalizeAnswer } from "~/lib/auth/security";
import { success, error } from "~/lib/api-response";

// GET — does the current user have a recovery question set, and what is it?
export async function GET({ request }: { request: Request }) {
  const auth = getUserFromRequest(request);
  if (!auth) return error("UNAUTHORIZED", "Not authenticated", 401);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { securityQuestion: true },
  });

  return success({
    hasQuestion: !!user?.securityQuestion,
    question: user?.securityQuestion ?? null,
  });
}

// POST — set or update the recovery question + answer for the current user.
export async function POST({ request }: { request: Request }) {
  const auth = getUserFromRequest(request);
  if (!auth) return error("UNAUTHORIZED", "Not authenticated", 401);

  const body = await request.json().catch(() => null);
  const parsed = securityQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  const { question, answer } = parsed.data;
  const securityAnswerHash = await hashPassword(normalizeAnswer(answer));

  await prisma.user.update({
    where: { id: auth.userId },
    data: { securityQuestion: question.trim(), securityAnswerHash },
  });

  return success({ hasQuestion: true, question: question.trim() });
}
