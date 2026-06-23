import { createMiddleware } from "@solidjs/start/middleware";
import { verifyAccessToken, readAccessToken } from "~/lib/auth/jwt";

export default createMiddleware({
  onRequest: [
    async (event) => {
      const publicPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/auth/logout',
        '/api/notes/public',
        '/api/users',
        '/login',
        '/register',
        '/share',
        '/profile',
        '/favicon.ico',
      ];

      const url = new URL(event.request.url);
      const pathname = url.pathname;

      // Exact match or a proper sub-path (next char is "/"), never a bare prefix.
      // Prevents e.g. "/login-as-admin" or "/profile-secret" from matching "/login"/"/profile".
      const isPublic = (p: string) => pathname === p || pathname.startsWith(p + '/');

      if (
        pathname.startsWith('/_build/') ||
        pathname.startsWith('/assets/') ||
        pathname.startsWith('/favicon') ||
        pathname === '/' ||
        publicPaths.some(isPublic)
      ) {
        return;
      }

      const cookieHeader = event.request.headers.get('cookie') || '';
      const token = readAccessToken(cookieHeader);

      if (!token) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'No access token' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        const payload = verifyAccessToken(token);
        (event as any).locals = { ...(event as any).locals, user: payload };
        Object.defineProperty(event.request, 'locals', {
          value: { ...(event.request as any).locals, user: payload },
          writable: true,
          configurable: true,
        });
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    },
  ],
});
