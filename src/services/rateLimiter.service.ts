/**
 * Rate Limiter Service
 *
 * In-memory rate limiting for API operations.
 * Uses sliding window algorithm for accurate rate limiting.
 * Note: This implementation does NOT use Redis to avoid connection errors.
 */

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();

  constructor() {
    // Periodic cleanup of old entries
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 60 * 1000); // Every minute
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      // Remove timestamps older than 24 hours (max window we support)
      const maxWindow = 24 * 60 * 60 * 1000;
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < maxWindow);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Check if a user has exceeded their rate limit
   * @param key Unique identifier for the rate limit (e.g., "api_key_creation:user_123")
   * @param limit Maximum number of requests allowed in the window
   * @param windowSeconds Time window in seconds
   * @returns Object with allowed status and remaining count
   */
  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    // Get or create entry
    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    // Check if over limit
    if (entry.timestamps.length >= limit) {
      // Get oldest timestamp to determine when the window resets
      const oldest = Math.min(...entry.timestamps);
      const resetAt = new Date(oldest + windowMs);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Add current request to the window
    entry.timestamps.push(now);

    return {
      allowed: true,
      remaining: limit - entry.timestamps.length,
      resetAt: new Date(now + windowMs),
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Get current count for a key
   */
  async getCount(key: string): Promise<number> {
    const entry = this.store.get(key);
    return entry ? entry.timestamps.length : 0;
  }

  /**
   * Close - no-op for in-memory implementation
   */
  async close(): Promise<void> {
    // No-op for in-memory implementation
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();
