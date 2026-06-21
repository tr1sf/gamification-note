import { prisma } from "~/lib/db";
import { hashPassword, verifyPassword } from "~/lib/auth/jwt";
import { normalizeAnswer } from "~/lib/auth/security";
import { forgotResetSchema } from "~/validators/auth";
import { success, error } from "~/lib/api-response";
import { rateLimit } from "~/lib/rate-limit";

// POST — verify the security answer and set a new password.
// Step 2 of the no-email password reset flow.
export async function POST({ request }: { request: Request }) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    // Tight limit — this endpoint is what an attacker would brute-force.
    if (!rateLimit(`forgot-reset:${ip}`, 5, 60000)) {
      return error("RATE_LIMITED", "Too many attempts. Try again in a minute.", 429);
    }

    const body = await request.json().catch(() => null);
    const parsed = forgotResetSchema.safeParse(body);
    if (!parsed.success) {
      return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
    }

    const { login, answer, password } = parsed.data;
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: login }, { username: login }] },
      select: { id: true, isBanned: true, securityAnswerHash: true },
    });

    // Same generic error for "no account", "no question set", and "wrong answer"
    // so the endpoint doesn't leak which accounts exist.
    const genericFail = () =>
      error("INVALID_ANSWER", "That answer doesn't match our records.", 400);

    if (!user || user.isBanned || !user.securityAnswerHash) {
      return genericFail();
    }

    const answerOk = await verifyPassword(normalizeAnswer(answer), user.securityAnswerHash);
    if (!answerOk) {
      return genericFail();
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      // Reset password AND invalidate existing sessions (refresh tokens).
      data: { passwordHash, refreshTokenHash: null },
    });

    return success({ reset: true });
  } catch (err) {
    console.error("[auth/forgot-password/reset] error:", err);
    return error("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
