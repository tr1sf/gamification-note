import { prisma } from "~/lib/db";
import { forgotQuestionSchema } from "~/validators/auth";
import { success, error } from "~/lib/api-response";
import { rateLimit } from "~/lib/rate-limit";

// POST — look up the recovery question for an account (by email or username).
// Step 1 of the no-email password reset flow.
export async function POST({ request }: { request: Request }) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!rateLimit(`forgot-question:${ip}`, 10, 60000)) {
      return error("RATE_LIMITED", "Too many attempts. Try again in a minute.", 429);
    }

    const body = await request.json().catch(() => null);
    const parsed = forgotQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
    }

    const { login } = parsed.data;
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: login }, { username: login }] },
      select: { securityQuestion: true, isBanned: true },
    });

    if (!user || user.isBanned || !user.securityQuestion) {
      // Generic message — don't reveal whether the account exists or has a question.
      return error(
        "NO_RECOVERY",
        "No security question is available for this account. Please contact support.",
        404
      );
    }

    return success({ question: user.securityQuestion });
  } catch (err) {
    console.error("[auth/forgot-password/question] error:", err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
