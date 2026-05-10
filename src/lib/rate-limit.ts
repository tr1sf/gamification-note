const buckets = new Map<string, { tokens: number; lastRefill: number }>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const cutoff = Date.now() - windowMs * 3;
    for (const [key, bucket] of buckets) {
      if (bucket.lastRefill < cutoff) buckets.delete(key);
    }
  }, windowMs).unref();
}

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  ensureCleanup(windowMs);

  const now = Date.now();
  const bucket = buckets.get(key) || { tokens: maxRequests, lastRefill: now };
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(maxRequests, bucket.tokens + (elapsed / windowMs) * maxRequests);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}
