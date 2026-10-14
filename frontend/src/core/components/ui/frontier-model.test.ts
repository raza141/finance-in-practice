import { describe, expect, it } from "vitest";

import { FrontierModel, type RiskReturn } from "./FrontierModel";

/** Return on the efficient edge at `sigma` (linear between hull points). */
function edgeAt(edge: RiskReturn[], sigma: number): number {
  for (let i = 1; i < edge.length; i++) {
    const [a, b] = [edge[i - 1], edge[i]];
    if (sigma <= b.sigma) return a.mu + ((b.mu - a.mu) * (sigma - a.sigma)) / (b.sigma - a.sigma);
  }
  return edge[edge.length - 1].mu;
}

describe("FrontierModel", () => {
  for (const seed of [1, 7, 42]) {
    const model = new FrontierModel(seed);
    const portfolios = model.portfolios(1500);
    const { efficient, inefficient } = model.frontier(portfolios);
    const rf = FrontierModel.RISK_FREE;

    it(`keeps every portfolio on or below the efficient edge and right of the minimum variance (seed ${seed})`, () => {
      const minVar = efficient[0];
      expect(inefficient[0]).toEqual(minVar);
      for (const p of portfolios) {
        expect(p.sigma).toBeGreaterThanOrEqual(minVar.sigma - 1e-12);
        if (p.sigma <= efficient[efficient.length - 1].sigma) expect(p.mu).toBeLessThanOrEqual(edgeAt(efficient, p.sigma) + 1e-9);
      }
    });

    it(`draws a rising, concave efficient edge (seed ${seed})`, () => {
      for (let i = 1; i < efficient.length; i++) {
        expect(efficient[i].sigma).toBeGreaterThan(efficient[i - 1].sigma);
        expect(efficient[i].mu).toBeGreaterThan(efficient[i - 1].mu);
      }
      const slopes = efficient.slice(1).map((p, i) => (p.mu - efficient[i].mu) / (p.sigma - efficient[i].sigma));
      for (let i = 1; i < slopes.length; i++) expect(slopes[i]).toBeLessThanOrEqual(slopes[i - 1] + 1e-9);
    });

    it(`picks the tangency portfolio with the best Sharpe ratio (seed ${seed})`, () => {
      const t = FrontierModel.tangency(efficient);
      const sharpe = (t.mu - rf) / t.sigma;
      for (const p of portfolios) expect((p.mu - rf) / p.sigma).toBeLessThanOrEqual(sharpe + 1e-9);
    });
  }
});
