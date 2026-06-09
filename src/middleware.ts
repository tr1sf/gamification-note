import { createMiddleware } from "@solidjs/start/middleware";
import { verifyAccessToken } from "~/lib/auth/jwt";

export default createMiddleware({
  onRequest: [
    async (event) => {
      const publicPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/auth/logout',
        '/login',
        '/register',
        '/favicon.ico',
      ];

      const url = new URL(event.request.url);

      if (
        url.pathname.startsWith('/_build') ||
        url.pathname.startsWith('/assets') ||
        url.pathname.startsWith('/favicon') ||
        url.pathname === '/' ||
        publicPaths.some(p => url.pathname.startsWith(p))
      ) {
        return;
      }

      const cookieHeader = event.request.headers.get('cookie') || '';
      const token = cookieHeader
        .split('; ')
        .find(c => c.startsWith('access_token='))
        ?.split('=')[1];

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
