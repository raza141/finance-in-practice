"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { TerminalAnimator } from "../animations/TerminalAnimator";
import { LiquidityCurveGeometry, type ChartBox } from "../services/LiquidityCurveGeometry";
import { TerminalFormat } from "../services/TerminalFormat";
import type { DayLiquidity } from "../types";

const BOX: ChartBox = {
  width: 720,
  height: 300,
  padding: { top: 20, right: 20, bottom: 38, left: 38 },
};

interface LiquidityCurveProps {
  days: DayLiquidity[];
  selectedDate: string | null;
  animator: TerminalAnimator;
  onSelect: (date: string) => void;
}

/**
 * Stage 2/3: 14-day "yield curve" of bookable liquidity. Hover drives the
 * crosshair readout; clicking a node locks the date and snaps the gold
 * limit-order line across the chart.
 */
export function LiquidityCurve({ days, selectedDate, animator, onSelect }: LiquidityCurveProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const bandRef = useRef<SVGPathElement>(null);
  const limitRef = useRef<SVGLineElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geometry = new LiquidityCurveGeometry(
    days.map((d) => d.slots.length),
    BOX,
  );
  const selectedIndex = selectedDate ? days.findIndex((d) => d.date === selectedDate) : -1;
  const focusIndex = hover ?? (selectedIndex >= 0 ? selectedIndex : null);

  useEffect(() => {
    if (pathRef.current) animator.drawCurve(pathRef.current, bandRef.current);
  }, [animator, days]);

  useEffect(() => {
    if (selectedIndex < 0 || !limitRef.current) return;
    animator.snapLimitLine(
      limitRef.current,
      geometry.points[selectedIndex].x,
      geometry.left,
      geometry.right,
    );
    // geometry is derived from days; re-run only when the locked node changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animator, selectedIndex]);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * BOX.width;
    setHover(geometry.nearestIndex(x));
  };

  const choose = (index: number) => {
    if (days[index].slots.length > 0) onSelect(days[index].date);
  };

  const onNodeKey = (event: KeyboardEvent, index: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(index);
    }
  };

  const readout =
    focusIndex === null
      ? "HOVER CURVE · CLICK A NODE TO LOCK DATE"
      : `DATE: ${TerminalFormat.date(days[focusIndex].date)} | LIQUIDITY: ${TerminalFormat.slots(days[focusIndex].slots.length)}`;

  return (
    <div>
      <div className="tabular-data flex items-center justify-between gap-3 border-b border-line/70 px-1 pb-2 font-mono text-xs tracking-wider">
        <span className="text-muted">
          LIQUIDITY CURVE <span className="text-muted/60">· 14D PROJECTION</span>
        </span>
        <span aria-live="polite" className={focusIndex === null ? "text-muted" : "text-quant"}>
          {readout}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        className="mt-2 h-auto min-h-64 w-full touch-none select-none"
        role="group"
        aria-label="Available demo slots over the next 14 days"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id="liquidity-plot">
            <rect
              x={geometry.left}
              y={geometry.top - 6}
              width={geometry.right - geometry.left}
              height={geometry.bottom - geometry.top + 6}
            />
          </clipPath>
          <linearGradient id="liquidity-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-quant)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-quant)" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* y grid + axis labels */}
        {geometry.gridValues().map((v) => (
          <g key={v}>
            <line
              x1={geometry.left}
              x2={geometry.right}
              y1={geometry.yFor(v)}
              y2={geometry.yFor(v)}
              stroke="var(--color-line)"
              strokeDasharray={v === 0 ? undefined : "2 4"}
            />
            <text
              x={geometry.left - 10}
              y={geometry.yFor(v) + 3.5}
              textAnchor="end"
              className="fill-muted font-mono text-xs"
            >
              {v}
            </text>
          </g>
        ))}

        {/* x labels: every other day */}
        {days.map((d, i) =>
          i % 2 === 0 ? (
            <text
              key={d.date}
              x={geometry.xAt(i)}
              y={BOX.height - 10}
              textAnchor="middle"
              className="fill-muted font-mono text-xs"
            >
              {TerminalFormat.date(d.date)}
            </text>
          ) : null,
        )}

        <g clipPath="url(#liquidity-plot)">
          <path ref={bandRef} d={geometry.bandPath()} fill="url(#liquidity-band)" />
          <path
            ref={pathRef}
            className="yield-curve-path"
            d={geometry.curvePath()}
            fill="none"
            stroke="var(--color-quant)"
            strokeWidth={2}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 6px rgb(34 211 238 / 0.45))" }}
          />
        </g>

        {/* crosshair */}
        {focusIndex !== null && (
          <g pointerEvents="none">
            <line
              x1={geometry.points[focusIndex].x}
              x2={geometry.points[focusIndex].x}
              y1={geometry.top}
              y2={geometry.bottom}
              stroke="var(--color-quant)"
              strokeOpacity={0.45}
              strokeDasharray="3 3"
            />
            <line
              x1={geometry.left}
              x2={geometry.right}
              y1={geometry.points[focusIndex].y}
              y2={geometry.points[focusIndex].y}
              stroke="var(--color-quant)"
              strokeOpacity={0.2}
              strokeDasharray="3 3"
            />
          </g>
        )}

        {/* gold limit-order line */}
        {selectedIndex >= 0 && (
          <g pointerEvents="none">
            <line
              ref={limitRef}
              x1={geometry.left}
              x2={geometry.right}
              y1={geometry.points[selectedIndex].y}
              y2={geometry.points[selectedIndex].y}
              stroke="var(--color-gold)"
              strokeWidth={1.5}
            />
            <text
              x={geometry.right - 4}
              y={geometry.points[selectedIndex].y - 6}
              textAnchor="end"
              className="fill-gold font-mono text-xs font-semibold"
            >
              LMT {TerminalFormat.date(days[selectedIndex].date)}
            </text>
          </g>
        )}

        {/* nodes */}
        {geometry.points.map((p, i) => {
          const empty = days[i].slots.length === 0;
          const selected = i === selectedIndex;
          return (
            <g
              key={days[i].date}
              role="button"
              tabIndex={empty ? -1 : 0}
              aria-disabled={empty}
              aria-pressed={selected}
              aria-label={`${TerminalFormat.weekday(days[i].date)} ${TerminalFormat.date(days[i].date)}, ${TerminalFormat.slots(days[i].slots.length)}`}
              className={`outline-none ${empty ? "cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => choose(i)}
              onKeyDown={(e) => onNodeKey(e, i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={selected ? 6 : 4}
                fill={selected ? "var(--color-gold)" : "var(--color-canvas)"}
                stroke={
                  selected ? "var(--color-gold)" : empty ? "var(--color-line)" : "var(--color-quant)"
                }
                strokeWidth={2}
              />
              {focusIndex === i && !selected && !empty && (
                <circle cx={p.x} cy={p.y} r={9} fill="none" stroke="var(--color-quant)" strokeOpacity={0.5} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
