import type { Request, Response, NextFunction } from "express";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/** Rate limiter en memoria por IP (ventana deslizante). Adecuado para instancia única (mock). */
export function createRateLimiter(opts: RateLimitOptions) {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const windowStart = now - opts.windowMs;
    const recent = (hits.get(ip) ?? []).filter((t) => t > windowStart);

    if (recent.length >= opts.max) {
      res.status(429).json({ error: "rate_limit_exceeded" });
      return;
    }

    recent.push(now);
    hits.set(ip, recent);
    next();
  };
}
