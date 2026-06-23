import { verifyAccessToken, readAccessToken } from "./jwt";

export function getUserFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = readAccessToken(cookieHeader);
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
