/**
 * In-memory sliding-window limiter, keyed by client identity.
 *
 * Best effort on serverless: each warm instance keeps its own window, so the
 * effective limit is per instance. Sufficient to blunt casual abuse of the
 * booking endpoint; move to a shared store (e.g. Upstash Redis) if needed.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Record a hit; returns false when `key` is over its limit. */
  allow(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => t - at < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(t);
    return true;
  }

  private prune(t: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((at) => t - at >= this.windowMs)) this.hits.delete(key);
    }
  }
}
