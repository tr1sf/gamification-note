import { signAccessToken } from "~/lib/auth/jwt";
import { getUserFromRequest } from "~/lib/auth/get-user";
import { success, error } from "~/lib/api-response";

export async function POST({ request }: { request: Request }) {
  // Resolve the user from the access-token cookie directly rather than relying
  // on the middleware's locals binding (which isn't reliably forwarded to the
  // route handler), consistent with every other authenticated endpoint.
  const user = getUserFromRequest(request);

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
