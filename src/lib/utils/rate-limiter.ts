/**
 * Simple rate limiter with exponential backoff
 */

interface RateLimiterOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  requestsPerWindow: number;
  windowMs: number;
}

const DEFAULT_OPTIONS: RateLimiterOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  requestsPerWindow: 10,
  windowMs: 60000,
};

interface RequestRecord {
  timestamp: number;
}

export class RateLimiter {
  private options: RateLimiterOptions;
  private requests: RequestRecord[] = [];

  constructor(options: Partial<RateLimiterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Wait until we can make a request (respecting rate limits)
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    // Clean old requests
    this.requests = this.requests.filter(r => r.timestamp > windowStart);

    // If under limit, we can proceed
    if (this.requests.length < this.options.requestsPerWindow) {
      this.requests.push({ timestamp: now });
      return;
    }

    // Find when the oldest request in our window will expire
    const oldestInWindow = this.requests[0];
    const waitTime = oldestInWindow.timestamp + this.options.windowMs - now;

    if (waitTime > 0) {
      await this.sleep(waitTime);
    }

    // Record this request
    this.requests.push({ timestamp: Date.now() });
  }

  /**
   * Execute a function with retries and exponential backoff
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: unknown) => boolean = () => true
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        await this.waitForSlot();
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === this.options.maxRetries || !shouldRetry(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.options.baseDelayMs * Math.pow(2, attempt),
          this.options.maxDelayMs
        );

        // Add jitter (±10%)
        const jitter = delay * 0.1 * (Math.random() * 2 - 1);
        const finalDelay = Math.round(delay + jitter);

        console.log(`Retry attempt ${attempt + 1}/${this.options.maxRetries} after ${finalDelay}ms`);
        await this.sleep(finalDelay);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit status
   */
  getStatus(): { remaining: number; limit: number; windowMs: number } {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    this.requests = this.requests.filter(r => r.timestamp > windowStart);

    return {
      remaining: this.options.requestsPerWindow - this.requests.length,
      limit: this.options.requestsPerWindow,
      windowMs: this.options.windowMs,
    };
  }
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('rate limit') ||
           message.includes('too many requests') ||
           message.includes('429');
  }
  return false;
}
