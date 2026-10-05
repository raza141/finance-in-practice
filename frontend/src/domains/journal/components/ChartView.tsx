"use client";

import { useEffect, useRef, useState } from "react";

import { ChartData, CsvText, type ParsedChart } from "../services/ChartData";
import type { ChartBlock } from "../types";
import { DownloadButton } from "./DownloadButton";

const MARGIN = { top: 12, right: 16, bottom: 34, left: 56 };
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const FULL = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const AS_OF = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "2026-10-03" -> "3 Oct 2026"; anything else unchanged. */
function asOfLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(d.getTime()) ? AS_OF.format(d) : iso;
}

interface Geometry {
  width: number;
  height: number;
  /** Horizontal centre of row i. */
  xOf: (i: number) => number;
  yOf: (v: number) => number;
  ticks: number[];
  band: number;
}

function geometry(chart: ParsedChart, kind: ChartBlock["kind"], width: number): Geometry {
  const height = Math.round(Math.min(380, Math.max(220, width * 0.55)));
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const n = chart.x.length;
  const [lo, hi] = ChartData.extent(chart, kind === "bar" || kind === "area");
  const ticks = ChartData.ticks(lo, hi);
  const [y0, y1] = [ticks[0], ticks.at(-1)!];
  const yOf = (v: number) => MARGIN.top + plotH - ((v - y0) / (y1 - y0 || 1)) * plotH;

  if (kind === "bar") {
    const band = plotW / n;
    return { width, height, band, ticks, yOf, xOf: (i) => MARGIN.left + band * (i + 0.5) };
  }
  if (chart.scale === "linear") {
    const xs = chart.x.map(Number);
    const [xmin, xmax] = [Math.min(...xs), Math.max(...xs)];
    return { width, height, band: 0, ticks, yOf, xOf: (i) => MARGIN.left + ((xs[i] - xmin) / (xmax - xmin || 1)) * plotW };
  }
  // ponytail: dates and categories are evenly spaced by row; irregular dates would need a time scale.
  return { width, height, band: 0, ticks, yOf, xOf: (i) => MARGIN.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW) };
}

/** Interactive chart for a chart block: hover/keyboard tooltip, data table, CSV download, provenance always visible. */
export function ChartView({ block }: { block: ChartBlock }) {
  const parsed = ChartData.parse(block.csv);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!parsed.ok) {
    return (
      <p role="alert" className="my-8 rounded-lg border border-gold/40 p-4 text-sm text-gold">
        Chart “{block.title}” can’t be drawn: {parsed.error}
      </p>
    );
  }
  const chart = parsed.chart;
  const g = geometry(chart, block.kind, width);
  const n = chart.x.length;
  const colors = ChartData.PALETTE;
  const unit = [block.unit, block.currency].filter(Boolean).join(" ");
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(width / 110))));

  function nearest(px: number): number {
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(g.xOf(i) - px) < Math.abs(g.xOf(best) - px)) best = i;
    return best;
  }

  /** Pointer position in viewBox units (the SVG may be drawn scaled). */
  function toChartX(e: React.PointerEvent<SVGSVGElement>): number {
    const box = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - box.left) / box.width) * g.width;
  }

  const rows = CsvText.parse(block.csv);
  const id = `chart-${block.id}`;

  return (
    <figure className="my-10" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="font-mono text-sm font-semibold text-ink">
        {block.title}
      </p>
      {chart.series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
          {chart.series.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[i] }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <div ref={box} className="relative mt-3 w-full">
        <svg
          // Drawn at the measured width; until measured it scales proportionally rather than letterboxing.
          viewBox={`0 0 ${g.width} ${g.height}`}
          role="img"
          aria-label={`${block.alt} Use the arrow keys to read each value.`}
          tabIndex={0}
          className="block h-auto w-full touch-pan-y outline-none focus-visible:ring-1 focus-visible:ring-quant"
          onPointerMove={(e) => setActive(nearest(toChartX(e)))}
          onPointerDown={(e) => setActive(nearest(toChartX(e)))}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            setActive((a) => Math.min(n - 1, Math.max(0, (a ?? (e.key === "ArrowRight" ? -1 : n)) + (e.key === "ArrowRight" ? 1 : -1))));
          }}
        >
          {g.ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={g.width - MARGIN.right} y1={g.yOf(t)} y2={g.yOf(t)} stroke="var(--color-line)" strokeWidth={t === 0 ? 1.5 : 1} />
              <text x={MARGIN.left - 8} y={g.yOf(t)} dy="0.32em" textAnchor="end" className="fill-muted font-mono text-[11px]">
                {COMPACT.format(t)}
              </text>
            </g>
          ))}
          {chart.x.map((label, i) =>
            // Every nth label, always the last, and none crowding the last.
            (i % labelEvery === 0 && n - 1 - i >= labelEvery / 2) || i === n - 1 ? (
              <text
                key={i}
                x={g.xOf(i)}
                y={g.height - MARGIN.bottom + 18}
                // Edge labels on line charts hug the plot so they aren't clipped.
                textAnchor={block.kind === "bar" || n === 1 ? "middle" : i === n - 1 ? "end" : i === 0 ? "start" : "middle"}
                className="fill-muted font-mono text-[11px]"
              >
                {label.length > 12 ? `${label.slice(0, 11)}…` : label}
              </text>
            ) : null,
          )}

          {block.kind === "bar" &&
            chart.series.map((s, si) => {
              const inner = (g.band * 0.75) / chart.series.length;
              return s.values.map((v, i) => {
                if (v === null) return null;
                const x = g.xOf(i) - (g.band * 0.75) / 2 + si * inner;
                const [top, bottom] = [Math.min(g.yOf(v), g.yOf(0)), Math.max(g.yOf(v), g.yOf(0))];
                return (
                  <rect
                    key={`${si}-${i}`}
                    x={x + 1}
                    y={top}
                    width={Math.max(1, inner - 2)}
                    height={Math.max(1, bottom - top)}
                    rx={Math.min(2, inner / 4)}
                    fill={colors[si]}
                    opacity={active === null || active === i ? 1 : 0.55}
                  />
                );
              });
            })}

          {(block.kind === "line" || block.kind === "area") &&
            chart.series.map((s, si) => {
              const segments: string[][] = [[]];
              s.values.forEach((v, i) => (v === null ? segments.push([]) : segments.at(-1)!.push(`${g.xOf(i)},${g.yOf(v)}`)));
              return (
                <g key={s.name}>
                  {segments
                    .filter((p) => p.length > 0)
                    .map((points, k) => (
                      <g key={k}>
                        {block.kind === "area" && (
                          <polygon
                            points={`${points[0].split(",")[0]},${g.yOf(0)} ${points.join(" ")} ${points.at(-1)!.split(",")[0]},${g.yOf(0)}`}
                            fill={colors[si]}
                            opacity={0.18}
                          />
                        )}
                        <polyline points={points.join(" ")} fill="none" stroke={colors[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                      </g>
                    ))}
                </g>
              );
            })}

          {block.kind === "scatter" &&
            chart.series.map((s, si) =>
              s.values.map((v, i) =>
                v === null ? null : (
                  <circle key={`${si}-${i}`} cx={g.xOf(i)} cy={g.yOf(v)} r={active === i ? 6 : 4} fill={colors[si]} stroke="var(--color-canvas)" strokeWidth={2} />
                ),
              ),
            )}

          {active !== null && block.kind !== "bar" && (
            <g>
              <line x1={g.xOf(active)} x2={g.xOf(active)} y1={MARGIN.top} y2={g.height - MARGIN.bottom} stroke="var(--color-muted)" strokeWidth={1} />
              {block.kind !== "scatter" &&
                chart.series.map((s, si) =>
                  s.values[active] === null ? null : (
                    <circle key={si} cx={g.xOf(active)} cy={g.yOf(s.values[active]!)} r={4} fill={colors[si]} stroke="var(--color-canvas)" strokeWidth={2} />
                  ),
                )}
            </g>
          )}
        </svg>

        {active !== null && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md border border-line bg-canvas/95 px-3 py-2 text-xs shadow-lg"
            style={
              g.xOf(active) > g.width / 2 ? { right: `calc(${(1 - g.xOf(active) / g.width) * 100}% + 12px)` } : { left: `calc(${(g.xOf(active) / g.width) * 100}% + 12px)` }
            }
          >
            <p className="font-mono text-muted">{chart.x[active]}</p>
            {chart.series.map((s, si) => (
              <p key={s.name} className="mt-1 flex items-center gap-2 whitespace-nowrap">
                <span aria-hidden className="h-2 w-2 rounded-sm" style={{ backgroundColor: colors[si] }} />
                <span className="text-muted">{s.name}</span>
                <span className="ml-auto font-mono text-ink">
                  {s.values[active] === null ? "—" : FULL.format(s.values[active]!)} {block.unit}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      <figcaption className="mt-3 space-y-1.5 text-xs text-muted">
        <p className="font-mono">
          Source:{" "}
          {block.sourceUrl ? (
            <a href={block.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-quant hover:underline">
              {block.source}
            </a>
          ) : (
            block.source
          )}
          {" · "}Data as of <time dateTime={block.asOf}>{asOfLabel(block.asOf)}</time>
          {block.frequency !== "n/a" && ` · ${block.frequency}`}
          {unit && ` · ${block.yLabel ? `${block.yLabel}, ` : ""}${unit}`}
        </p>
        {block.caption && <p className="text-sm text-ink/80">{block.caption}</p>}
      </figcaption>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls={`${id}-table`}
          className="inline-flex h-8 items-center rounded-md border border-line px-3 text-xs text-muted transition-colors hover:border-quant/60 hover:text-ink"
        >
          {showTable ? "Hide data" : "View data"}
        </button>
        <DownloadButton content={ChartData.csvFor(block)} filename={`${block.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "chart"}.csv`} type="text/csv" label="CSV" />
      </div>

      {showTable && (
        <div id={`${id}-table`} className="mt-3 max-h-80 overflow-auto rounded-lg border border-line">
          <table className="tabular-data w-full text-left text-xs">
            <caption className="sr-only">{block.title} data</caption>
            <thead className="sticky top-0 bg-surface">
              <tr>
                {rows[0].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-semibold text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.slice(1).map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-1.5 text-ink/85">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="mt-3 text-sm">
        <summary className="font-mono text-xs text-muted hover:text-ink">Methodology &amp; limitations</summary>
        <dl className="mt-2 space-y-2 border-l border-line pl-4 text-ink/80">
          <dt className="font-mono text-[11px] tracking-wider text-muted uppercase">Methodology</dt>
          <dd>{block.methodology}</dd>
          <dt className="font-mono text-[11px] tracking-wider text-muted uppercase">Limitations</dt>
          <dd>{block.limitations}</dd>
        </dl>
      </details>
    </figure>
  );
}
