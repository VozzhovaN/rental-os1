/**
 * In-memory login rate limiter (per process).
 * MULTI_INSTANCE_RATE_LIMIT = PRODUCTION_HARDENING_PENDING
 * Bounded memory + expiry cleanup. Keys are ip:/email: only — never password-derived.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_KEYS = 5_000;

export function resetLoginRateLimitForTests() {
  buckets.clear();
}

function pruneExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
  if (buckets.size <= MAX_KEYS) return;
  // Evict oldest resetAt first when over cap
  const entries = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  const overflow = buckets.size - MAX_KEYS;
  for (let i = 0; i < overflow; i++) {
    buckets.delete(entries[i]![0]);
  }
}

export function checkLoginRateLimit(keys: string[]): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  pruneExpired(now);
  let blockedUntil = 0;

  for (const key of keys) {
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (bucket.resetAt <= now) {
      buckets.delete(key);
      continue;
    }
    if (bucket.count >= MAX_ATTEMPTS) {
      blockedUntil = Math.max(blockedUntil, bucket.resetAt);
    }
  }

  if (blockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((blockedUntil - now) / 1000) };
  }
  return { allowed: true };
}

export function recordLoginFailure(keys: string[]) {
  const now = Date.now();
  pruneExpired(now);
  for (const key of keys) {
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      existing.count += 1;
    }
  }
  pruneExpired(now);
}

export function clearLoginFailures(keys: string[]) {
  for (const key of keys) {
    buckets.delete(key);
  }
}
