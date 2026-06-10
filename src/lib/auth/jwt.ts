import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '~/lib/env';

const tokenPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  username: z.string(),
});

export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

const ACCESS_EXPIRY_SEC = 900; // 15 minutes
const REFRESH_EXPIRY_SEC = 604800; // 7 days

const JWT_ALG = "HS256" as const;

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY_SEC, algorithm: JWT_ALG });
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [JWT_ALG] });
  return tokenPayloadSchema.parse(decoded);
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY_SEC, algorithm: JWT_ALG });
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: [JWT_ALG] });
  return tokenPayloadSchema.parse(decoded);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function setAuthCookies(accessToken: string, refreshToken: string): string[] {
  const secureFlag = env.NODE_ENV === 'production' ? '; Secure' : '';
  return [
    `access_token=${accessToken}; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=${ACCESS_EXPIRY_SEC}`,
    `refresh_token=${refreshToken}; HttpOnly${secureFlag}; SameSite=Lax; Path=/api/auth; Max-Age=${REFRESH_EXPIRY_SEC}`,
  ];
}

export function clearAuthCookies(): string[] {
  const secureFlag = env.NODE_ENV === 'production' ? '; Secure' : '';
  return [
    `access_token=; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=0`,
    `refresh_token=; HttpOnly${secureFlag}; SameSite=Lax; Path=/api/auth; Max-Age=0`,
  ];
}
