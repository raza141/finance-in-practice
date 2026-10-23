import { Inline, RichText } from "@/domains/journal/components/RichText";
import { ChartData } from "@/domains/journal/services/ChartData";

import { MockExhibits } from "../services/MockExhibits";
import { ExhibitChart } from "./ExhibitChart";

/** A mock's vignette, question or explanation: text with its tables and charts (MockExhibits). */
export function ExhibitText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {MockExhibits.parse(text).map((p, i) =>
        p.kind === "text" ? (
          <RichText key={i} text={p.text} />
        ) : (
          <figure key={i} className={`rounded-lg border border-line ${p.kind === "chart" ? "max-w-2xl p-3" : "overflow-x-auto"}`}>
            {p.title && (
              <figcaption className={p.kind === "chart" ? "text-sm font-semibold" : "border-b border-line bg-surface-raised/60 px-3 py-2 text-sm font-semibold"}>
                {p.title}
              </figcaption>
            )}
            {p.kind === "chart" ? (
              <ExhibitChart part={p} table={<ExhibitTable header={p.header} rows={p.rows} />} />
            ) : (
              <ExhibitTable header={p.header} rows={p.rows} />
            )}
          </figure>
        ),
      )}
    </div>
  );
}

/** Numbers right-aligned in a monospace column, so they line up the way a printed exhibit does. */
const numeric = (cell: string) => cell !== "" && !Number.isNaN(ChartData.number(cell) ?? Number.NaN);

function ExhibitTable({ header, rows }: { header: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-muted">
        <tr>
          {header.map((h, i) => (
            <th key={i} scope="col" className={`px-3 py-2 font-medium whitespace-nowrap ${i > 0 ? "text-right" : ""}`}>
              <Inline text={h} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) => (
              <td key={i} className={`px-3 py-1.5 ${i > 0 ? "text-right" : ""} ${i > 0 && numeric(cell) ? "font-mono whitespace-nowrap tabular-nums" : ""}`}>
                <Inline text={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
