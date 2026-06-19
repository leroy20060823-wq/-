import type { Request, Response, NextFunction } from "express";

/** Current UTC calendar day, e.g. "2026-06-19". Used as the rollover key. */
function utcDayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Global daily kill switch (NOT per-IP). Counts every allowed request across the
 * whole process for the current UTC day; once the count passes `max`, generation
 * pauses for everyone until the next day. In-memory only — a free-tier restart
 * resets the counter, which is acceptable for a soft cost guard. Swap the counter
 * for a shared store (Redis/DB) if you scale to multiple processes.
 */
export function createGlobalDailyLimiter(opts: { max: number; message: string }) {
  const { max, message } = opts;
  let day = utcDayKey();
  let count = 0;

  return (_req: Request, res: Response, next: NextFunction): void => {
    const today = utcDayKey();
    if (today !== day) {
      day = today;
      count = 0;
    }

    if (count >= max) {
      res.setHeader("Retry-After", "86400");
      res.status(429).json({ error: message });
      return;
    }

    count += 1;
    next();
  };
}
