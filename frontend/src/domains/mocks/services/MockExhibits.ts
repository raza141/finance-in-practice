import { ChartData, CsvText } from "@/domains/journal/services/ChartData";

/** A run of plain text (the journal's inline markup), a table, or a line chart, in the order written. */
export type ExhibitPart =
  | { kind: "text"; text: string }
  | { kind: "table"; title: string; header: string[]; rows: string[][] }
  | { kind: "chart"; title: string; header: string[]; rows: string[][]; csv: string };

/** "Table: …", "Exhibit 2: …" or "Chart: …" on the line just above the rows. */
const TITLE = /^\s*(table|chart|exhibit[^:|]{0,20}):\s*(.*)$/i;
const ROW = /^\s*\|/;
const RULE = /^\s*\|?[\s:|-]*-{2,}[\s:|-]*$/;

/**
 * Exhibits inside a mock's vignette, question or explanation, written as pipe rows so they
 * survive one Excel cell (Alt+Enter between lines) and a CSV upload:
 *
 *   Exhibit 1: Delta Corp income statement     Chart: Spot rate curve
 *   | AED m | 2025 | 2024 |                     | Maturity (years) | Spot rate (%) |
 *   | Revenue | 840 | 790 |                     | 1 | 3.20 |
 *
 * The first row is the header; a |---| rule is optional. "Chart:" draws the rows as a line
 * chart (first column across, every other column a line), e.g. a term structure. Pure.
 */
export class MockExhibits {
  static readonly MAX_ROWS = 40;
  static readonly MAX_COLUMNS = 8;
  /** Lines on one chart: the first three palette slots stay apart for colour-blind readers. */
  static readonly MAX_LINES = 3;

  static parse(text: string): ExhibitPart[] {
    const parts: ExhibitPart[] = [];
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    let plain: string[] = [];
    const flush = () => {
      const t = plain.join("\n").trim();
      if (t) parts.push({ kind: "text", text: t });
      plain = [];
    };
    for (let i = 0; i < lines.length; i++) {
      if (!ROW.test(lines[i])) {
        // A title line only counts when rows follow it.
        if (!(TITLE.test(lines[i]) && ROW.test(lines[i + 1] ?? ""))) plain.push(lines[i]);
        continue;
      }
      const titled = TITLE.exec(lines[i - 1] ?? "");
      const block: string[] = [];
      while (i < lines.length && ROW.test(lines[i])) block.push(lines[i++]);
      i--;
      flush();
      const [header = [], ...rows] = block.filter((l) => !RULE.test(l)).map(MockExhibits.cells);
      const chart = titled?.[1].toLowerCase() === "chart";
      const title = titled ? (chart || titled[1].toLowerCase() === "table" ? titled[2].trim() : `${titled[1].trim()}: ${titled[2].trim()}`) : "";
      parts.push(chart ? { kind: "chart", title, header, rows, csv: CsvText.stringify([header, ...rows]) } : { kind: "table", title, header, rows });
    }
    flush();
    return parts;
  }

  /** What's wrong with the exhibits in one field, for the upload's row errors (empty: fine). */
  static problems(text: string, field: string): string[] {
    if (!text.includes("|")) return [];
    return MockExhibits.parse(text).flatMap((p): string[] => {
      if (p.kind === "text") return [];
      const name = `${field} ${p.kind}${p.title ? ` "${p.title}"` : ""}`;
      if (p.rows.length === 0) return [`${name} has a header but no rows`];
      if (p.rows.length > MockExhibits.MAX_ROWS) return [`${name} has over ${MockExhibits.MAX_ROWS} rows`];
      if (p.header.length > MockExhibits.MAX_COLUMNS) return [`${name} has over ${MockExhibits.MAX_COLUMNS} columns`];
      const bad = p.rows.findIndex((r) => r.length !== p.header.length);
      if (bad >= 0) return [`${name} row ${bad + 1} has ${p.rows[bad].length} cells, the header has ${p.header.length}`];
      if (p.kind === "chart") {
        const parsed = ChartData.parse(p.csv);
        if (!parsed.ok) return [`${name}: ${parsed.error}`];
        if (parsed.chart.series.length > MockExhibits.MAX_LINES) return [`${name} has over ${MockExhibits.MAX_LINES} lines`];
      }
      return [];
    });
  }

  private static cells(line: string): string[] {
    return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  }
}
