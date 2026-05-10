export function success<T>(data: T, meta?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: meta || {},
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export function error(code: string, message: string, status: number, details?: unknown) {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message, details },
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
