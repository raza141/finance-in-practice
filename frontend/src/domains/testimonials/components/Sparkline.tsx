"use client";

import { useEffect, useRef, useState } from "react";

import { OrderBookAnimator } from "../animations/OrderBookAnimator";

const W = 140;
const H = 44;
const PAD = 5;
/** Headroom around the two scores, in score points, so every move fills the box. */
const MARGIN = 12;

interface SparklineProps {
  before: number;
  after: number;
  /** Stagger between cards so a column of fills doesn't draw in lockstep. */
  delay?: number;
}

/** Score path from `before` to `after`, scaled to the move; draws itself when first scrolled into view. */
export function Sparkline({ before, after, delay = 0 }: SparklineProps) {
  const root = useRef<SVGSVGElement>(null);
  const path = useRef<SVGPathElement>(null);
  const marker = useRef<SVGCircleElement>(null);
  const [animator] = useState(() => new OrderBookAnimator());

  useEffect(() => {
    const svg = root.current;
    if (!svg || !path.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !path.current) return;
        observer.disconnect();
        animator.drawSparkline(path.current, marker.current, delay);
      },
      { threshold: 0.6 },
    );
    observer.observe(svg);
    return () => {
      observer.disconnect();
      animator.stop();
    };
  }, [animator, delay]);

  const lo = Math.max(0, Math.min(before, after) - MARGIN);
  const hi = Math.min(100, Math.max(before, after) + MARGIN);
  const y = (score: number) => PAD + ((hi - score) / (hi - lo)) * (H - 2 * PAD);
  const [x0, x1, y0, y1] = [PAD, W - PAD, y(before), y(after)];
  const up = after >= before;
  const colour = up ? "var(--color-quant)" : "var(--color-gold)";
  // Ease-in-out cubic between the two scores: reads as a price move, not a ruler line.
  const d = `M${x0},${y0} C${x0 + (x1 - x0) * 0.45},${y0} ${x0 + (x1 - x0) * 0.55},${y1} ${x1},${y1}`;

  return (
    <svg
      ref={root}
      viewBox={`0 0 ${W} ${H}`}
      className="h-11 w-full max-w-[140px] overflow-visible"
      role="img"
      aria-label={`Score moved from ${before}% to ${after}%`}
    >
      <line x1={x0} x2={x1} y1={y0} y2={y0} stroke="currentColor" strokeOpacity={0.18} strokeDasharray="2 3" className="text-muted" />
      <circle cx={x0} cy={y0} r={2} fill="var(--color-muted)" />
      <path ref={path} d={d} pathLength={1} fill="none" stroke={colour} strokeWidth={1.75} strokeLinecap="round" />
      <circle ref={marker} cx={x1} cy={y1} r={3} fill={colour} style={{ transformOrigin: `${x1}px ${y1}px` }} />
    </svg>
  );
}
