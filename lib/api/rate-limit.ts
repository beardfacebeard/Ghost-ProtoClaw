type RateLimitResult = {
  allowed: boolean;
  retryAfter?: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export function createRateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitEntry>();

  function cleanup(now: number) {
    store.forEach((entry, key) => {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    });
  }

  function getEntry(key: string, now: number) {
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      const freshEntry = {
        count: 0,
        resetAt: now + windowMs
      };
      store.set(key, freshEntry);
      return freshEntry;
    }

    return existing;
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      cleanup(now);
      const entry = getEntry(key, now);

      if (entry.count >= maxRequests) {
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
        };
      }

      return { allowed: true };
    },
    increment(key: string) {
      const now = Date.now();
      cleanup(now);
      const entry = getEntry(key, now);
      entry.count += 1;
      store.set(key, entry);
    },
    reset(key: string) {
      store.delete(key);
    }
  };
}

export const loginRateLimiter = createRateLimiter(5, 15 * 60 * 1000);
export const apiRateLimiter = createRateLimiter(100, 60 * 1000);
export const forgotPasswordRateLimiter = createRateLimiter(3, 15 * 60 * 1000);
