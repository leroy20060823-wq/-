import type { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Minimal in-memory fixed-window rate limiter keyed by client IP. Suitable for a
 * single-process free-tier deploy; swap for a shared store if you scale out.
 * Requires `app.set("trust proxy", 1)` so req.ip reflects the real client.
 */
export function createRateLimiter(opts: { windowMs: number; max: number; message: string }) {
  const { windowMs, max, message } = opts;
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();

    // Lazy prune so the map doesn't grow unbounded.
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
    }

    const key = req.ip ?? "unknown";
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}
