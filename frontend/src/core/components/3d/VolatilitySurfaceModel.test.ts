import { describe, expect, it } from "vitest";

import { VolatilitySurfaceModel } from "./VolatilitySurfaceModel";

const noiseless = new VolatilitySurfaceModel({ ...VolatilitySurfaceModel.DEFAULTS, noise: 0 });

describe("VolatilitySurfaceModel", () => {
  it("has a smile: wings carry more volatility than at-the-money", () => {
    for (const T of [0.1, 0.5, 1]) {
      const atm = noiseless.sigma(0, T);
      expect(noiseless.sigma(-0.8, T)).toBeGreaterThan(atm);
      expect(noiseless.sigma(0.8, T)).toBeGreaterThan(atm);
    }
  });

  it("has a put skew: OTM puts are richer than equidistant OTM calls", () => {
    expect(noiseless.sigma(-0.6, 0.3)).toBeGreaterThan(noiseless.sigma(0.6, 0.3));
  });

  it("flattens with maturity: short-dated smiles are steeper", () => {
    const curvature = (T: number) => noiseless.sigma(0.8, T) + noiseless.sigma(-0.8, T) - 2 * noiseless.sigma(0, T);
    expect(curvature(0.05)).toBeGreaterThan(curvature(1));
  });

  it("stays positive and in a plausible range across the grid", () => {
    const model = new VolatilitySurfaceModel();
    for (let k = -1; k <= 1; k += 0.1) {
      for (let T = 0; T <= 1; T += 0.1) {
        const s = model.sigma(k, T, 12.3);
        expect(s).toBeGreaterThan(0.05);
        expect(s).toBeLessThan(0.8);
      }
    }
  });

  it("value noise is smooth, bounded and deterministic", () => {
    const a = VolatilitySurfaceModel.noise(1.234, 5.678, 9.1);
    expect(VolatilitySurfaceModel.noise(1.234, 5.678, 9.1)).toBe(a);
    expect(Math.abs(VolatilitySurfaceModel.noise(1.234 + 1e-4, 5.678, 9.1) - a)).toBeLessThan(1e-2);
    for (let i = 0; i < 500; i++) {
      const v = VolatilitySurfaceModel.noise(i * 0.37, i * 0.11, i * 0.07);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("fills only the z component of a plane position buffer", () => {
    const segments = 4;
    const n = (segments + 1) ** 2;
    const positions = new Float32Array(n * 3).fill(7);
    new VolatilitySurfaceModel().fill(positions, segments, 0, 10);
    for (let i = 0; i < n; i++) {
      expect(positions[i * 3]).toBe(7);
      expect(positions[i * 3 + 1]).toBe(7);
      expect(Number.isFinite(positions[i * 3 + 2])).toBe(true);
    }
  });
});
