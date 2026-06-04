/**
 * In-process sliding-window rate limiter.
 *
 * Suitable for Next.js API routes running on a single Node.js process
 * (Railway, Vercel serverless with consistent routing, local dev).
 *
 * For multi-instance deployments, swap the Map for a Redis store.
 */

interface Window {
  timestamps: number[];
}

const store = new Map<string, Window>();

// Purge stale keys every 10 minutes to prevent unbounded memory growth.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
    for (const [key, win] of store.entries()) {
      if ((win.timestamps.at(-1) ?? 0) < cutoff) store.delete(key);
    }
  }, 10 * 60 * 1000);
}

export interface RateLimitResult {
  allowed : boolean;
  remaining: number;
  resetMs  : number; // ms until oldest entry expires
}

/**
 * Check whether `key` is within `maxRequests` over the last `windowMs` milliseconds.
 *
 * @param key         — unique identifier (e.g. IP address, email hash)
 * @param maxRequests — maximum attempts allowed in the window
 * @param windowMs    — sliding window size in milliseconds
 */
export function checkRateLimit(
  key        : string,
  maxRequests: number,
  windowMs   : number,
): RateLimitResult {
  const now    = Date.now();
  const cutoff = now - windowMs;

  const win = store.get(key) ?? { timestamps: [] };

  // Drop entries outside the window
  win.timestamps = win.timestamps.filter(t => t > cutoff);

  if (win.timestamps.length >= maxRequests) {
    const oldest  = win.timestamps[0];
    const resetMs = oldest + windowMs - now;
    store.set(key, win);
    return { allowed: false, remaining: 0, resetMs };
  }

  win.timestamps.push(now);
  store.set(key, win);

  return {
    allowed  : true,
    remaining: maxRequests - win.timestamps.length,
    resetMs  : windowMs,
  };
}

/**
 * Extract the best available IP from a Next.js NextRequest.
 * Falls back to 'unknown' so the limiter still works but doesn't crash.
 */
export function getClientIp(req: { headers: { get: (k: string) => string | null } }): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
