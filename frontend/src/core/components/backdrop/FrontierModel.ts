export interface RiskReturn {
  /** Volatility (standard deviation of returns). */
  sigma: number;
  /** Expected return. */
  mu: number;
}

export interface FrontierAsset extends RiskReturn {
  name: string;
}

/**
 * Mean-variance maths behind the portal's animated backdrop, long-only (no
 * shorting, fully invested, like a real IPS): many random portfolios, the
 * efficient frontier as the upper-left edge of what they can reach, the
 * inefficient lower edge, and the max-Sharpe (tangency) portfolio the capital
 * market line touches. Plausible long-run figures, not forecasts; `seed`
 * nudges them so each cycle looks a little different.
 */
export class FrontierModel {
  static readonly RISK_FREE = 0.03;
  private static readonly BASE = [
    { name: "Bonds", mu: 0.045, sigma: 0.06 },
    { name: "Gold", mu: 0.055, sigma: 0.15 },
    { name: "Real estate", mu: 0.075, sigma: 0.13 },
    { name: "Global equities", mu: 0.09, sigma: 0.16 },
    { name: "EM equities", mu: 0.11, sigma: 0.23 },
  ];
  private static readonly CORRELATION = [
    [1, 0.2, 0.25, 0.1, 0.05],
    [0.2, 1, 0.1, 0.05, 0.15],
    [0.25, 0.1, 1, 0.6, 0.5],
    [0.1, 0.05, 0.6, 1, 0.75],
    [0.05, 0.15, 0.5, 0.75, 1],
  ];

  readonly assets: FrontierAsset[];
  private readonly mu: number[];
  private readonly cov: number[][];
  private readonly random: () => number;

  constructor(seed = 1) {
    let state = seed >>> 0 || 1;
    this.random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
    this.assets = FrontierModel.BASE.map((a) => ({ ...a, mu: a.mu * (0.9 + this.random() * 0.2), sigma: a.sigma * (0.9 + this.random() * 0.2) }));
    this.mu = this.assets.map((a) => a.mu);
    this.cov = this.assets.map((a, i) => this.assets.map((b, j) => FrontierModel.CORRELATION[i][j] * a.sigma * b.sigma));
  }

  /** Random fully invested long-only portfolios (skewed draws, so corners and mixes both appear). */
  portfolios(count: number): RiskReturn[] {
    return Array.from({ length: count }, () => {
      const raw = this.mu.map(() => (-Math.log(1 - this.random())) ** 2.2);
      const total = raw.reduce((s, w) => s + w, 0);
      return this.point(raw.map((w) => w / total));
    });
  }

  /**
   * Frontier edges of a long-only cloud: every two-asset mix (fine steps)
   * plus `extra` portfolios, reduced to the concave upper-left hull (efficient)
   * and the lower-left hull (inefficient), both starting at the minimum-variance point.
   */
  frontier(extra: readonly RiskReturn[]): { efficient: RiskReturn[]; inefficient: RiskReturn[] } {
    const pool: RiskReturn[] = [...extra];
    const n = this.mu.length;
    for (let i = 0; i < n; i++)
      for (let j = i; j < n; j++)
        for (let k = 0; k <= 40; k++) {
          const w = new Array<number>(n).fill(0);
          w[i] += k / 40;
          w[j] += 1 - k / 40;
          pool.push(this.point(w));
        }
    const sorted = pool.toSorted((a, b) => a.sigma - b.sigma || b.mu - a.mu);
    const minVar = sorted[0];
    return {
      efficient: FrontierModel.hull(sorted.filter((p) => p.mu >= minVar.mu), 1),
      inefficient: FrontierModel.hull(sorted.filter((p) => p.mu <= minVar.mu), -1),
    };
  }

  /** The efficient point with the highest Sharpe ratio. */
  static tangency(efficient: readonly RiskReturn[], rf = FrontierModel.RISK_FREE): RiskReturn {
    return efficient.reduce((best, p) => ((p.mu - rf) / p.sigma > (best.mu - rf) / best.sigma ? p : best));
  }

  private point(weights: number[]): RiskReturn {
    const mu = weights.reduce((s, w, i) => s + w * this.mu[i], 0);
    let variance = 0;
    for (let i = 0; i < weights.length; i++) for (let j = 0; j < weights.length; j++) variance += weights[i] * weights[j] * this.cov[i][j];
    return { mu, sigma: Math.sqrt(variance) };
  }

  /**
   * Monotone-chain hull of points sorted by sigma: side 1 keeps the upper edge
   * (only points that raise return), side -1 the lower edge (only points that lower it).
   */
  private static hull(points: readonly RiskReturn[], side: 1 | -1): RiskReturn[] {
    const chain: RiskReturn[] = [];
    let extreme = -Infinity;
    for (const p of points) {
      if (side * p.mu <= extreme) continue;
      extreme = side * p.mu;
      while (chain.length >= 2) {
        const [a, b] = [chain[chain.length - 2], chain[chain.length - 1]];
        const cross = (b.sigma - a.sigma) * (p.mu - a.mu) - (b.mu - a.mu) * (p.sigma - a.sigma);
        if (side * cross >= 0) chain.pop();
        else break;
      }
      chain.push(p);
    }
    return chain;
  }
}
