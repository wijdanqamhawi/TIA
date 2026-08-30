/**
 * Pluggable rate-limit abstraction (research.md §13). The default
 * in-memory store is fine for a single Node.js server instance; swap the
 * `RateLimitStore` implementation (e.g. for a Redis-backed store) without
 * touching any call site.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number): RateLimitResult;
}

class InMemoryRateLimitStore implements RateLimitStore {
  private hits = new Map<string, { count: number; resetAt: number }>();

  consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || entry.resetAt <= now) {
      const resetAt = now + windowMs;
      this.hits.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: limit - 1, resetAt };
    }

    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count += 1;
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
  }
}

let store: RateLimitStore = new InMemoryRateLimitStore();

export function setRateLimitStore(customStore: RateLimitStore): void {
  store = customStore;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  return store.consume(key, limit, windowMs);
}
