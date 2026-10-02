/**
 * Stylised implied-volatility surface σ(k, T) used for the hero visual.
 *
 *   σ(k, T) = base + termSlope·e^(−T/τ) + smile·k²/√(T+ε) + skew·k + noise(k, T, t)
 *
 * - k: log-moneyness in [−1, 1] (OTM puts left, OTM calls right)
 * - T: maturity in [0, 1] (front month at 0)
 * Short-dated smiles are steeper, the put wing is richer (skew < 0), and a
 * small value-noise term keeps the surface "breathing" over time t.
 */
export interface SurfaceParams {
  base: number;
  termSlope: number;
  termDecay: number;
  smile: number;
  skew: number;
  noise: number;
}

export class VolatilitySurfaceModel {
  static readonly DEFAULTS: SurfaceParams = {
    base: 0.18,
    termSlope: 0.07,
    termDecay: 0.35,
    smile: 0.09,
    skew: -0.06,
    noise: 0.012,
  };

  constructor(private readonly params: SurfaceParams = VolatilitySurfaceModel.DEFAULTS) {}

  /** Implied volatility at log-moneyness k, maturity T, animation time t (seconds). */
  sigma(k: number, T: number, t = 0): number {
    const p = this.params;
    const term = p.termSlope * Math.exp(-T / p.termDecay);
    const smile = (p.smile * k * k) / Math.sqrt(T + 0.15);
    const skew = p.skew * k;
    return p.base + term + smile + skew + p.noise * VolatilitySurfaceModel.noise(k * 2.2, T * 2.2, t * 0.35);
  }

  /**
   * Write heights into a flat (x, y, z) position buffer laid out as a
   * (segments+1)² grid, mapping x -> k and y -> T. Height is σ scaled by
   * `heightScale` and centred on the surface's base level.
   */
  fill(positions: Float32Array, segments: number, t: number, heightScale: number): void {
    const n = segments + 1;
    for (let iy = 0; iy < n; iy++) {
      const T = iy / segments;
      for (let ix = 0; ix < n; ix++) {
        const k = (ix / segments) * 2 - 1;
        const z = (this.sigma(k, T, t) - this.params.base) * heightScale;
        positions[(iy * n + ix) * 3 + 2] = z;
      }
    }
  }

  /** Smooth 3D value noise in [−1, 1] (hash lattice + quintic fade). */
  static noise(x: number, y: number, z: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const fx = VolatilitySurfaceModel.fade(x - xi);
    const fy = VolatilitySurfaceModel.fade(y - yi);
    const fz = VolatilitySurfaceModel.fade(z - zi);
    const h = VolatilitySurfaceModel.hash;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const x00 = lerp(h(xi, yi, zi), h(xi + 1, yi, zi), fx);
    const x10 = lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), fx);
    const x01 = lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), fx);
    const x11 = lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), fx);
    return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz) * 2 - 1;
  }

  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /** Deterministic integer-lattice hash to [0, 1). */
  private static hash(x: number, y: number, z: number): number {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
}
