type RateLimitEntry = {
  count: number;
  reset: number;
};

const store = new Map<string, RateLimitEntry>();

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

export function checkRateLimit(
  identifier: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
): { success: boolean; retryAfter: number; remaining: number } {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now >= entry.reset) {
    store.set(identifier, { count: 1, reset: now + windowMs });
    return {
      success: true,
      retryAfter: Math.ceil(windowMs / 1000),
      remaining: limit - 1,
    };
  }

  if (entry.count >= limit) {
    return {
      success: false,
      retryAfter: Math.max(1, Math.ceil((entry.reset - now) / 1000)),
      remaining: 0,
    };
  }

  entry.count += 1;
  return {
    success: true,
    retryAfter: Math.max(1, Math.ceil((entry.reset - now) / 1000)),
    remaining: Math.max(0, limit - entry.count),
  };
}

export function resetRateLimit(identifier?: string) {
  if (identifier) {
    store.delete(identifier);
  } else {
    store.clear();
  }
}

export const RATE_LIMIT_DEFAULT = {
  limit: DEFAULT_LIMIT,
  windowMs: DEFAULT_WINDOW_MS,
};
