/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * SAAS RATE LIMITER ABSTRACTION FOR MULTI-INSTANCE SCALING
 */

export interface RateLimiterOptions {
  maxTokens: number;
  refillRatePerSec: number;
  windowMs: number;
}

export class SaasRateLimiter {
  private tokens: Map<string, { count: number; lastRefill: number }>;
  private options: RateLimiterOptions;

  constructor(options: Partial<RateLimiterOptions> = {}) {
    this.options = {
      maxTokens: options.maxTokens || 60,
      refillRatePerSec: options.refillRatePerSec || 10,
      windowMs: options.windowMs || 60000,
    };
    this.tokens = new Map();
  }

  public checkLimit(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    let record = this.tokens.get(key);

    if (!record) {
      record = { count: this.options.maxTokens, lastRefill: now };
      this.tokens.set(key, record);
    }

    // Refill tokens based on elapsed time
    const elapsedMs = now - record.lastRefill;
    const refilledTokens = (elapsedMs / 1000) * this.options.refillRatePerSec;
    
    if (refilledTokens > 0) {
      record.count = Math.min(this.options.maxTokens, record.count + refilledTokens);
      record.lastRefill = now;
    }

    if (record.count >= 1) {
      record.count -= 1;
      return {
        allowed: true,
        remaining: Math.floor(record.count),
        retryAfterMs: 0,
      };
    } else {
      const retryAfterMs = Math.ceil(((1 - record.count) / this.options.refillRatePerSec) * 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
      };
    }
  }

  public resetKey(key: string): void {
    this.tokens.delete(key);
  }
}

export const globalSaasRateLimiter = new SaasRateLimiter({
  maxTokens: 100,
  refillRatePerSec: 20,
  windowMs: 60000,
});
