import { json } from "@solidjs/router";
import { prisma } from "~/lib/db";
import { hashPassword } from "~/lib/auth/jwt";
import { registerSchema } from "~/validators/auth";
import { success, error } from "~/lib/api-response";
import { rateLimit } from "~/lib/rate-limit";

export async function POST({ request }: { request: Request }) {
  // Rate limit temporarily disabled for testing
  // const ip = request.headers.get("x-forwarded-for") || "unknown";
  // if (!rateLimit(`register:${ip}`, 5, 1800000)) {
  //   return error("RATE_LIMITED", "Too many registration attempts. Try again in 30 minutes.", 429);
  // }

  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return error("VALIDATION_ERROR", "Invalid input", 400, parsed.error.flatten());
  }

  const { email, username, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    const field = existing.email === email ? "email" : "username";
    return error("CONFLICT", `${field} already taken`, 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, username, passwordHash },
    select: { id: true, email: true, username: true, level: true, xp: true, coins: true, title: true, createdAt: true },
  });

  return success(user);
}
