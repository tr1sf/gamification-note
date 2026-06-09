import { verifyAccessToken } from "./jwt";

export function getUserFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader
    .split("; ")
    .find((c) => c.startsWith("access_token="))
    ?.split("=")[1];
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
