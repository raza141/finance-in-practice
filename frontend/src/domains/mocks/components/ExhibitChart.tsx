"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { ChartData } from "@/domains/journal/services/ChartData";

import type { ExhibitPart } from "../services/MockExhibits";

const H = 260;
const M = { top: 18, right: 20, bottom: 42, left: 44 };
const VALUE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

/**
 * A line chart exhibit such as a term structure, drawn at the width it's shown at so the
 * text stays readable on a phone. Few points: each is labelled with its value as typed, like
 * the printed exhibit; past that the rows sit under the chart. `table` is the same rows as a table.
 */
export function ExhibitChart({ part, table }: { part: Extract<ExhibitPart, { kind: "chart" }>; table: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const parsed = ChartData.parse(part.csv);
  // The upload refuses a chart that doesn't parse; an older row still shows its numbers.
  if (!parsed.ok) return table;
  const { chart } = parsed;
  const ticks = ChartData.ticks(...ChartData.extent(chart, false), 4);
  const [y0, y1] = [ticks[0], ticks.at(-1)!];
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const xs = chart.scale === "linear" ? chart.x.map(Number) : chart.x.map((_, i) => i);
  const [xmin, xmax] = [Math.min(...xs), Math.max(...xs)];
  const xOf = (i: number) => M.left + (xmax === xmin ? plotW / 2 : ((xs[i] - xmin) / (xmax - xmin)) * plotW);
  const yOf = (v: number) => M.top + plotH - ((v - y0) / (y1 - y0 || 1)) * plotH;
  const labelled = chart.series.length === 1 && chart.x.length <= Math.floor(plotW / 36);
  const [xLabel, ...names] = part.header;
  const colors = ChartData.PALETTE;

  return (
    <>
      {chart.series.length === 1 ? (
        <p className="mt-1 text-xs text-muted">{names[0]}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
          {chart.series.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: colors[i] }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div ref={box} className="mt-2 w-full">
        <svg viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`${part.title || "Chart"}: ${names.join(", ")} by ${xLabel}.`} className="block h-auto w-full">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={yOf(t)} y2={yOf(t)} stroke="var(--color-line)" />
              <text x={M.left - 8} y={yOf(t)} dy="0.32em" textAnchor="end" className="fill-muted font-mono text-[11px]">
                {VALUE.format(t)}
              </text>
            </g>
          ))}
          {chart.x.map((x, i) => (
            <text key={i} x={xOf(i)} y={H - M.bottom + 18} textAnchor="middle" className="fill-muted font-mono text-[11px]">
              {x}
            </text>
          ))}
          <text x={M.left + plotW / 2} y={H - 4} textAnchor="middle" className="fill-muted text-[11px]">
            {xLabel}
          </text>
          {chart.series.map((s, si) => {
            const points = s.values.flatMap((v, i) => (v === null ? [] : [{ i, v }]));
            return (
              <g key={s.name}>
                <polyline points={points.map((p) => `${xOf(p.i)},${yOf(p.v)}`).join(" ")} fill="none" stroke={colors[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {points.map((p, k) => (
                  <g key={p.i}>
                    <circle cx={xOf(p.i)} cy={yOf(p.v)} r={4} fill={colors[si]} stroke="var(--color-canvas)" strokeWidth={2}>
                      <title>{`${s.name} at ${chart.x[p.i]}: ${part.rows[p.i][si + 1]}`}</title>
                    </circle>
                    {labelled && (
                      // Below the point where the line rises to the right, so a label never sits on the line.
                      <text
                        x={xOf(p.i)}
                        y={yOf(p.v) + ((points[k + 1]?.v ?? -Infinity) > p.v ? 20 : -10)}
                        textAnchor={k === 0 ? "start" : k === points.length - 1 ? "end" : "middle"}
                        className="fill-ink font-mono text-[12px]"
                      >
                        {part.rows[p.i][si + 1]}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      {!labelled && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-xs text-muted">Show the numbers</summary>
          <div className="mt-2 overflow-x-auto">{table}</div>
        </details>
      )}
    </>
  );
}
