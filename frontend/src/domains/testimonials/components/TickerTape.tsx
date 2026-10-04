"use client";

import { useEffect, useRef, useState } from "react";

import { OrderBookAnimator } from "../animations/OrderBookAnimator";
import { TestimonialContract } from "../services/TestimonialContract";
import type { TickerQuote } from "../types";

/** Repeat short quote lists so one copy is always wider than the viewport. */
const MIN_ITEMS = 12;

function TapeItems({ quotes, hidden }: { quotes: readonly TickerQuote[]; hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {quotes.map((quote, i) => {
        const up = quote.avgYieldPercent >= 0;
        return (
          <li key={`${quote.ticker}-${i}`} className="tabular-data flex items-center gap-2 px-6 text-sm whitespace-nowrap">
            <span className="font-semibold text-ink">{TestimonialContract.SYMBOLS[quote.ticker]}</span>
            <span className={up ? "text-quant" : "text-gold"}>
              {up ? "▲" : "▼"} {TestimonialContract.formatYield(quote.avgYieldPercent)}
            </span>
            <span className="text-xs text-muted">
              {quote.fills} {quote.fills === 1 ? "fill" : "fills"}
            </span>
            <span aria-hidden className="ml-4 text-line">│</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Infinite tape of average yield per ticker. Pauses on hover; static under reduced motion. */
export function TickerTape({ quotes }: { quotes: readonly TickerQuote[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [animator] = useState(() => new OrderBookAnimator());

  useEffect(() => {
    if (!track.current || quotes.length === 0) return;
    animator.tape(track.current);
    return () => animator.stop();
  }, [animator, quotes]);

  if (quotes.length === 0) {
    return (
      <div className="tabular-data border-y border-line bg-canvas/70 py-3 text-center text-xs tracking-[0.2em] text-muted uppercase">
        Market opens with the first approved fill
      </div>
    );
  }

  const copies = Math.ceil(MIN_ITEMS / quotes.length);
  const run = Array.from({ length: copies }, () => quotes).flat();

  return (
    <div
      className="relative overflow-hidden border-y border-line bg-canvas/70 py-3 backdrop-blur-sm"
      onPointerEnter={() => animator.setTapePaused(true)}
      onPointerLeave={() => animator.setTapePaused(false)}
    >
      <p className="sr-only">
        Average yield by ticker:{" "}
        {quotes.map((q) => `${TestimonialContract.SYMBOLS[q.ticker]} ${TestimonialContract.formatYield(q.avgYieldPercent)} over ${q.fills} fills`).join(", ")}
      </p>
      {/* Two identical halves: the animation shifts by exactly one half, then loops. */}
      <div ref={track} aria-hidden className="flex w-max will-change-transform">
        <TapeItems quotes={run} />
        <TapeItems quotes={run} hidden />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-canvas to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-canvas to-transparent" />
    </div>
  );
}
