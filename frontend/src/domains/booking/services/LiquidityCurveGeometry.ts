export interface Point {
  x: number;
  y: number;
}

export interface ChartBox {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

/**
 * Maps a daily liquidity series (slot counts) into SVG geometry: node
 * coordinates, a smooth "yield curve" path, and a translucent range band.
 */
export class LiquidityCurveGeometry {
  readonly points: Point[];
  readonly yMax: number;
  /** Gridline spacing: a 1/2/5 x 10^k step giving roughly four intervals. */
  readonly yStep: number;

  constructor(
    private readonly values: readonly number[],
    readonly box: ChartBox,
    minYMax = 5,
  ) {
    if (values.length < 2) throw new Error("a curve needs at least two points");
    const rawMax = Math.max(minYMax, ...values);
    this.yStep = LiquidityCurveGeometry.niceStep(rawMax / 4);
    this.yMax = Math.ceil(rawMax / this.yStep) * this.yStep;
    this.points = values.map((value, i) => ({ x: this.xAt(i), y: this.yFor(value) }));
  }

  get left(): number {
    return this.box.padding.left;
  }

  get right(): number {
    return this.box.width - this.box.padding.right;
  }

  get top(): number {
    return this.box.padding.top;
  }

  get bottom(): number {
    return this.box.height - this.box.padding.bottom;
  }

  xAt(index: number): number {
    return this.left + (index / (this.values.length - 1)) * (this.right - this.left);
  }

  yFor(value: number): number {
    return this.bottom - (value / this.yMax) * (this.bottom - this.top);
  }

  /** Index of the node horizontally closest to an x coordinate in chart units. */
  nearestIndex(x: number): number {
    const t = (x - this.left) / (this.right - this.left);
    return Math.min(this.values.length - 1, Math.max(0, Math.round(t * (this.values.length - 1))));
  }

  /** Smooth curve through every node (Catmull-Rom converted to cubic Béziers). */
  curvePath(): string {
    return LiquidityCurveGeometry.smooth(this.points);
  }

  /**
   * Closed band around the curve: rolling min/max over a ±1-day window,
   * padded by `pad` slots and clamped to the chart.
   */
  bandPath(pad = 0.45): string {
    const upper = this.values.map((_, i) => {
      const window = this.values.slice(Math.max(0, i - 1), i + 2);
      return { x: this.xAt(i), y: this.yFor(Math.min(this.yMax, Math.max(...window) + pad)) };
    });
    const lower = this.values.map((_, i) => {
      const window = this.values.slice(Math.max(0, i - 1), i + 2);
      return { x: this.xAt(i), y: this.yFor(Math.max(0, Math.min(...window) - pad)) };
    });
    const back = LiquidityCurveGeometry.smooth([...lower].reverse());
    return `${LiquidityCurveGeometry.smooth(upper)} L${back.slice(1)} Z`;
  }

  /** Horizontal gridline values from 0 to yMax in `yStep` increments. */
  gridValues(): number[] {
    return Array.from({ length: this.yMax / this.yStep + 1 }, (_, i) => i * this.yStep);
  }

  /** Smallest integer step of the form {1, 2, 5} x 10^k that is >= `raw`. */
  static niceStep(raw: number): number {
    if (raw <= 1) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw);
    return step ?? 10 * magnitude;
  }

  /**
   * Monotone cubic interpolation (Fritsch–Carlson, 1980) as cubic Béziers.
   * Unlike Catmull-Rom it never overshoots between nodes, so the curve can't
   * imply negative or above-peak availability.
   */
  static smooth(points: Point[]): string {
    const n = points.length;
    const f = (v: number) => Number(v.toFixed(2));
    const h = points.slice(0, -1).map((p, k) => points[k + 1].x - p.x);
    const delta = points.slice(0, -1).map((p, k) => (points[k + 1].y - p.y) / h[k]);

    const m = points.map((_, k) => {
      if (k === 0) return delta[0];
      if (k === n - 1) return delta[n - 2];
      return delta[k - 1] * delta[k] <= 0 ? 0 : (delta[k - 1] + delta[k]) / 2;
    });
    for (let k = 0; k < n - 1; k++) {
      if (delta[k] === 0) {
        m[k] = 0;
        m[k + 1] = 0;
        continue;
      }
      const a = m[k] / delta[k];
      const b = m[k + 1] / delta[k];
      const norm = a * a + b * b;
      if (norm > 9) {
        const t = 3 / Math.sqrt(norm);
        m[k] = t * a * delta[k];
        m[k + 1] = t * b * delta[k];
      }
    }

    let d = `M${f(points[0].x)},${f(points[0].y)}`;
    for (let k = 0; k < n - 1; k++) {
      const p1 = points[k];
      const p2 = points[k + 1];
      const third = h[k] / 3;
      d += ` C${f(p1.x + third)},${f(p1.y + m[k] * third)} ${f(p2.x - third)},${f(p2.y - m[k + 1] * third)} ${f(p2.x)},${f(p2.y)}`;
    }
    return d;
  }
}
