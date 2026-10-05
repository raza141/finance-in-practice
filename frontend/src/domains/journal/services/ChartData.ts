import type { ChartBlock } from "../types";

export type XScale = "time" | "linear" | "category";

export interface ChartSeries {
  name: string;
  values: (number | null)[];
}

export interface ParsedChart {
  x: string[];
  scale: XScale;
  series: ChartSeries[];
}

/** CSV in, rows out. Handles quoted fields and tab-separated text pasted from Excel. */
export class CsvText {
  static parse(text: string): string[][] {
    const source = text.replace(/\r\n?/g, "\n").trim();
    if (!source) return [];
    const delimiter = source.split("\n", 1)[0].includes("\t") ? "\t" : ",";
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (quoted) {
        if (ch === '"' && source[i + 1] === '"') {
          field += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"' && field === "") quoted = true;
      else if (ch === delimiter) {
        row.push(field.trim());
        field = "";
      } else if (ch === "\n") {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = "";
      } else field += ch;
    }
    row.push(field.trim());
    rows.push(row);
    return rows;
  }

  static stringify(rows: readonly (readonly (string | number)[])[]): string {
    return rows
      .map((row) => row.map((cell) => (/[",\n]/.test(String(cell)) ? `"${String(cell).replace(/"/g, '""')}"` : String(cell))).join(","))
      .join("\n");
  }
}

/** Turns a chart block's CSV into series, and supplies the axis maths for drawing it. */
export class ChartData {
  static readonly MAX_SERIES = 6;
  /** Scatter shows every pair of series together; only the first three palette slots separate under that test. */
  static readonly MAX_SCATTER_SERIES = 3;
  static readonly MAX_POINTS = 5000;

  /** Categorical slots validated on the site's dark surface (#0b1120); never cycled. */
  static readonly PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"] as const;

  private static readonly DATE = /^\d{4}-\d{2}(-\d{2})?$/;

  /** "1,234.5" / "5%" / "(3.2)" -> numbers; blank -> null; anything else -> NaN. */
  static number(cell: string): number | null {
    const trimmed = cell.trim();
    if (trimmed === "" || trimmed === "-" || /^n\/?a$/i.test(trimmed)) return null;
    const negative = /^\(.*\)$/.test(trimmed);
    const cleaned = trimmed.replace(/^\(|\)$/g, "").replace(/[,%\s]/g, "").replace(/^[A-Z$€£]{1,3}(?=[-\d.])/i, "");
    const value = cleaned === "" ? Number.NaN : Number(cleaned);
    return negative ? -value : value;
  }

  static parse(csv: string): { ok: true; chart: ParsedChart } | { ok: false; error: string } {
    const rows = CsvText.parse(csv);
    if (rows.length < 3) return { ok: false, error: "Paste a header row and at least two data rows." };
    const [header, ...data] = rows;
    if (header.length < 2) return { ok: false, error: "Need an x column and at least one series column." };
    if (header.length - 1 > ChartData.MAX_SERIES) return { ok: false, error: `At most ${ChartData.MAX_SERIES} series; fold the rest into "Other".` };
    if (data.length > ChartData.MAX_POINTS) return { ok: false, error: `At most ${ChartData.MAX_POINTS} rows.` };

    const x = data.map((r) => r[0] ?? "");
    const series: ChartSeries[] = [];
    for (let col = 1; col < header.length; col++) {
      const values: (number | null)[] = [];
      for (const [i, row] of data.entries()) {
        const value = ChartData.number(row[col] ?? "");
        if (Number.isNaN(value)) return { ok: false, error: `Row ${i + 2}, column "${header[col]}": "${row[col]}" is not a number.` };
        values.push(value);
      }
      series.push({ name: header[col] || `Series ${col}`, values });
    }
    const scale: XScale = x.every((v) => ChartData.DATE.test(v))
      ? "time"
      : x.every((v) => v !== "" && Number.isFinite(Number(v)))
        ? "linear"
        : "category";
    return { ok: true, chart: { x, scale, series } };
  }

  /** "Nice" axis ticks (1, 2, 2.5, 5 × 10^n) spanning [min, max]. */
  static ticks(min: number, max: number, count = 5): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
    if (min === max) {
      const pad = Math.abs(min) * 0.1 || 1;
      min -= pad;
      max += pad;
    }
    const raw = (max - min) / count;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
    const start = Math.floor(min / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toPrecision(12)));
    if (ticks.at(-1)! < max) ticks.push(Number((ticks.at(-1)! + step).toPrecision(12)));
    return ticks;
  }

  /** Value range across every series; bars always include zero. */
  static extent(chart: ParsedChart, includeZero: boolean): [number, number] {
    const values = chart.series.flatMap((s) => s.values.filter((v): v is number => v !== null));
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (includeZero) {
      min = Math.min(0, min);
      max = Math.max(0, max);
    }
    return [min, max];
  }

  /** The CSV readers download: the block's data, normalised. */
  static csvFor(block: ChartBlock): string {
    return CsvText.stringify(CsvText.parse(block.csv));
  }
}
