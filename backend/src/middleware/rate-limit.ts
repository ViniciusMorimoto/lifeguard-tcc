import type { Request, RequestHandler } from 'express';
import { HttpError } from '../lib/http-error.js';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  prefix: string;
  message?: string;
  key?: (req: Request) => string;
};

type Bucket = { hits: number; resetAt: number };

const MAX_BUCKETS = 10_000;
const buckets = new Map<string, Bucket>();

function removeExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function createRateLimit(options: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size >= MAX_BUCKETS) {
      removeExpired(now);
      if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value as string);
    }

    const identity = options.key?.(req) || req.ip || req.socket.remoteAddress || 'unknown';
    const bucketKey = `${options.prefix}:${identity}`;
    const previous = buckets.get(bucketKey);
    const bucket = previous && previous.resetAt > now
      ? previous
      : { hits: 0, resetAt: now + options.windowMs };

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, options.max - bucket.hits - 1)));
    res.setHeader('RateLimit-Reset', String(retryAfterSeconds));

    if (bucket.hits >= options.max) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      next(new HttpError(
        429,
        options.message ?? 'Muitas solicitações. Aguarde alguns minutos e tente novamente.',
        'RATE_LIMITED',
      ));
      return;
    }

    bucket.hits += 1;
    buckets.set(bucketKey, bucket);
    next();
  };
}

export function clearRateLimitsForTests() {
  buckets.clear();
}
