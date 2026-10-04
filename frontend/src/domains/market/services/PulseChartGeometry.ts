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
  /** First date when the line starts later than the window (ADX while it builds history); its base 100 is that day. */
  since?: string;
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
  /** A line needs two closes to be a line; shorter histories start part-way along the date axis. */
  static readonly MIN_POINTS = 2;

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

    // x is shared by date, so a market closed on a holiday, or a series with a
    // shorter history, lines up with the others instead of being stretched.
    const dates = [...new Set(charted.flatMap((s) => s.history.map((p) => p.date)))].sort();
    const col = new Map(dates.map((d, i) => [d, i]));
    const step = innerW / Math.max(1, dates.length - 1);
    const first = dates[0];

    const lines = charted.map((s) => ({
      key: s.key,
      label: s.label,
      color: PulseChartGeometry.COLORS[s.key],
      points: s.history.map((p) => ({ ...p, x: round(this.pad.left + col.get(p.date)! * step), y: round(y(p.norm)) })),
      ...(s.history[0].date > first && { since: s.history[0].date }),
    }));
    return { lines, baseY: round(y(100)), width: this.width, height: this.height };
  }

  /** The day nearest to x (viewBox units) and each line's close on it: what the hover tooltip shows. Lines with no close that day are left out. */
  static nearest(chart: PulseChart, x: number): { line: ChartLine; point: ChartPoint }[] {
    const all = chart.lines.flatMap((line) => line.points);
    const day = all.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best)).date;
    return chart.lines.flatMap((line) => {
      const point = line.points.find((p) => p.date === day);
      return point ? [{ line, point }] : [];
    });
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
