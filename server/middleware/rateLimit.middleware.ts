import { Request, Response, NextFunction } from 'express';
import { extractClientIp } from '../utils/ip';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
  skip?: (req: Request) => boolean;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 10000;

/**
 * Lightweight, bounded in-memory fixed-window rate limiter for Express routes.
 * Sends standard RateLimit-* and Retry-After headers and responds with 429 on excess traffic.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  let lastPrune = Date.now();

  function prune(now: number) {
    if (now - lastPrune < options.windowMs && buckets.size < MAX_BUCKETS) {
      return;
    }
    lastPrune = now;
    for (const [k, b] of buckets.entries()) {
      if (b.resetAt <= now) {
        buckets.delete(k);
      }
    }
    // Hard cap against IP spray memory exhaustion
    if (buckets.size >= MAX_BUCKETS) {
      const overflow = buckets.size - Math.floor(MAX_BUCKETS * 0.8);
      let removed = 0;
      for (const k of buckets.keys()) {
        buckets.delete(k);
        removed++;
        if (removed >= overflow) break;
      }
    }
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'OPTIONS' || options.skip?.(req)) {
      return next();
    }

    const now = Date.now();
    prune(now);

    const ip = extractClientIp(req) || req.socket?.remoteAddress || 'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const existing = buckets.get(key);

    let bucket: Bucket;
    if (!existing || existing.resetAt <= now) {
      bucket = { count: 1, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    } else {
      existing.count += 1;
      bucket = existing;
    }

    const remaining = Math.max(0, options.maxRequests - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader('RateLimit-Limit', String(options.maxRequests));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (bucket.count > options.maxRequests) {
      res.setHeader('Retry-After', String(resetSeconds));
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        code: 'RATE_LIMIT_EXCEEDED',
        message: options.message || 'Too many requests. Please wait a moment and try again.',
      });
      return;
    }

    next();
  };
}

/**
 * General API rate limiter: 240 requests per minute per client IP across all API endpoints.
 */
export const generalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 240,
  keyPrefix: 'api',
  message: 'Too many API requests from this network. Please retry in a minute.',
  skip: (req) => req.path === '/health' || req.path === '/api/health',
});

/**
 * Stricter rate limiter for sensitive unauthenticated auth endpoints (login, signup, password reset).
 */
export const authEndpointRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 40,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skip: (req) =>
    req.method === 'GET' ||
    req.path === '/logout' ||
    req.path === '/switch-tenant',
});
