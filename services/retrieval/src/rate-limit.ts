/**
 * Sliding-window in-memory rate limiter.
 * Safe for serverless (each cold start gets a fresh window; Vercel function
 * instances are short-lived so memory cannot grow unbounded).
 */

const DEFAULT_RPM = 100;
const DEFAULT_OPENAI_RPM = 100;
const WINDOW_MS = 60_000;

const hits = new Map<string, number[]>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, timestamps] of hits) {
      const filtered = timestamps.filter((t) => t > cutoff);
      if (filtered.length === 0) hits.delete(key);
      else hits.set(key, filtered);
    }
  }, WINDOW_MS);
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(
  key: string,
  maxRpm = Number(process.env.RATE_LIMIT_RPM) || DEFAULT_RPM,
): RateLimitResult {
  ensureCleanup();
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const existing = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (existing.length >= maxRpm) {
    const oldestInWindow = existing[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestInWindow + WINDOW_MS - now,
    };
  }

  existing.push(now);
  hits.set(key, existing);

  return {
    allowed: true,
    remaining: maxRpm - existing.length,
    resetMs: WINDOW_MS,
  };
}

/**
 * Global rate limiter for OpenAI API calls (cost protection).
 * Tracks all OpenAI calls across all users in a single sliding window.
 * Default: 30 RPM — configurable via OPENAI_RATE_LIMIT_RPM env var.
 */
export function checkOpenAIRateLimit(): RateLimitResult {
  const maxRpm = Number(process.env.OPENAI_RATE_LIMIT_RPM) || DEFAULT_OPENAI_RPM;
  return checkRateLimit("__openai_global__", maxRpm);
}
