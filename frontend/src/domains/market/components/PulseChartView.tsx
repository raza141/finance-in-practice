"use client";

import { useState } from "react";

import { MarketPulseContract } from "../services/MarketPulseContract";
import { PulseChartGeometry, type PulseChart } from "../services/PulseChartGeometry";

const VALUE = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Line chart with a crosshair tooltip on hover/touch; arrow keys step through days when focused. */
export function PulseChartView({ chart }: { chart: PulseChart }) {
  const [x, setX] = useState<number | null>(null);
  const hits = x === null ? null : PulseChartGeometry.nearest(chart, x);
  const anchor = hits?.[0].point;
  const xs = [...new Set(chart.lines.flatMap((l) => l.points.map((p) => p.x)))].sort((a, b) => a - b);

  function fromPointer(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    setX(((event.clientX - box.left) / box.width) * chart.width);
  }

  function fromKey(event: React.KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const at = anchor ? xs.indexOf(anchor.x) : xs.length;
    const next = Math.min(xs.length - 1, Math.max(0, at + (event.key === "ArrowRight" ? 1 : -1)));
    setX(xs[next]);
  }

  return (
    <div className="relative mt-3">
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-auto w-full touch-pan-y outline-none focus-visible:ring-1 focus-visible:ring-quant"
        role="img"
        tabIndex={0}
        aria-label={`Rebased to 100: ${chart.lines.map((l) => `${l.label} ${l.points.at(-1)!.norm.toFixed(1)}`).join(", ")}. Use arrow keys to read each day.`}
        onPointerMove={fromPointer}
        onPointerDown={fromPointer}
        onPointerLeave={() => setX(null)}
        onKeyDown={fromKey}
        onBlur={() => setX(null)}
      >
        <line x1="0" x2={chart.width} y1={chart.baseY} y2={chart.baseY} stroke="var(--color-line)" strokeDasharray="3 4" />
        {chart.lines.map((l) => (
          <polyline
            key={l.key}
            points={l.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={l.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {anchor && (
          <line x1={anchor.x} x2={anchor.x} y1="0" y2={chart.height} stroke="var(--color-muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
        {(hits ?? chart.lines.map((line) => ({ line, point: line.points.at(-1)! }))).map(({ line, point }) => (
          <circle key={line.key} cx={point.x} cy={point.y} r="3" fill={line.color} stroke="var(--color-surface)" strokeWidth="2" />
        ))}
      </svg>

      {hits && anchor && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute top-0 z-10 min-w-40 rounded-md border border-line bg-canvas/95 px-3 py-2 text-[11px] shadow-lg"
          style={anchor.x > chart.width / 2 ? { right: `${100 - (anchor.x / chart.width) * 100 + 2}%` } : { left: `${(anchor.x / chart.width) * 100 + 2}%` }}
        >
          <p className="text-muted">{MarketPulseContract.formatDate(anchor.date)}</p>
          {hits.map(({ line, point }) => (
            <p key={line.key} className="mt-1 flex items-center gap-2 whitespace-nowrap">
              <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ backgroundColor: line.color }} />
              <span className="text-muted">{line.label}</span>
              <span className="ml-auto text-ink">{VALUE.format(point.value)}</span>
              <span className="text-ink/70">({point.norm.toFixed(1)})</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
