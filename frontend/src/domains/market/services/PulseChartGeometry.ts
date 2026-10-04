import type { PulseSeries } from "../types";

export interface ChartPoint {
  x: number;
  y: number;
  date: string;
  value: number;
  norm: number;
}

export interface ChartLine {
  key: string;
  label: string;
  color: string;
  points: ChartPoint[];
}

export interface PulseChart {
  lines: ChartLine[];
  /** y of the base-100 reference line. */
  baseY: number;
  width: number;
  height: number;
}

/**
 * Normalised (base 100) performance lines for the equity indices. VIX and
 * the T-bill are left out: rebasing a volatility level or a yield to 100
 * says nothing useful, so they stay in the table only.
 */
export class PulseChartGeometry {
  /** Fixed per index so a series never changes colour when another drops out. Validated on the dark surface. */
  static readonly COLORS: Readonly<Record<string, string>> = {
    SPX: "#0891b2",
    KSE100: "#8b5cf6",
    ADX: "#d97706",
  };
  /** A line needs this many closes before it is drawn (ADX is still building history). */
  static readonly MIN_POINTS = 20;

  constructor(
    private readonly width = 400,
    private readonly height = 100,
    private readonly pad = { top: 8, right: 8, bottom: 8, left: 8 },
  ) {}

  build(series: PulseSeries[]): PulseChart | null {
    const charted = series
      .filter((s) => s.key in PulseChartGeometry.COLORS)
      .map((s) => ({ ...s, history: s.history.filter((p): p is Omit<ChartPoint, "x" | "y"> => p.norm !== null) }))
      .filter((s) => s.history.length >= PulseChartGeometry.MIN_POINTS);
    if (charted.length === 0) return null;

    const norms = charted.flatMap((s) => s.history.map((p) => p.norm));
    const lo = Math.min(100, ...norms);
    const hi = Math.max(100, ...norms);
    const span = hi - lo || 1;
    const innerW = this.width - this.pad.left - this.pad.right;
    const innerH = this.height - this.pad.top - this.pad.bottom;
    const y = (norm: number) => this.pad.top + ((hi - norm) / span) * innerH;

    const lines = charted.map((s) => {
      // ponytail: plots by index, not date; markets with different holidays drift a day apart. Align on dates if it shows.
      const step = innerW / (s.history.length - 1);
      return {
        key: s.key,
        label: s.label,
        color: PulseChartGeometry.COLORS[s.key],
        points: s.history.map((p, i) => ({ ...p, x: round(this.pad.left + i * step), y: round(y(p.norm)) })),
      };
    });
    return { lines, baseY: round(y(100)), width: this.width, height: this.height };
  }

  /** Each line's point nearest to x (viewBox units): what the hover tooltip shows. */
  static nearest(chart: PulseChart, x: number): { line: ChartLine; point: ChartPoint }[] {
    return chart.lines.map((line) => ({
      line,
      point: line.points.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best)),
    }));
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
