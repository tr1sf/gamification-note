import { signAccessToken } from "~/lib/auth/jwt";
import { success, error } from "~/lib/api-response";

export async function POST({ request, locals }: { request: Request; locals: Record<string, unknown> }) {
  const user = (locals as any)?.user as { userId: string; email: string; username: string } | undefined;

  if (!user) {
    return error("UNAUTHORIZED", "Not authenticated", 401);
  }

  const token = signAccessToken({
    userId: user.userId,
    email: user.email,
    username: user.username,
  });

  return success({ token });
}
