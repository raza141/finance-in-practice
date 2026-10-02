"use client";

import { useEffect, useRef } from "react";

import type { TerminalAnimator } from "../animations/TerminalAnimator";
import type { BookingTrack, TrackId } from "../types";

interface TrackTabsProps {
  tracks: readonly BookingTrack[];
  locked: TrackId | null;
  disabled?: boolean;
  animator: TerminalAnimator;
  onLock: (id: TrackId) => void;
}

function findTab(list: HTMLElement | null, id: TrackId | null): HTMLElement | null {
  return id ? (list?.querySelector<HTMLElement>(`[data-track="${id}"]`) ?? null) : null;
}

/** Stage 1: asset-class tabs. Hover glides the cyan underline; click locks the track. */
export function TrackTabs({ tracks, locked, disabled = false, animator, onLock }: TrackTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  const glideTo = (id: TrackId | null) => {
    if (indicatorRef.current) {
      animator.moveIndicator(indicatorRef.current, findTab(listRef.current, id));
    }
  };

  // Keep the underline on the locked tab (also after layout changes such as resize).
  useEffect(() => {
    const settle = () => {
      if (indicatorRef.current) {
        animator.moveIndicator(indicatorRef.current, findTab(listRef.current, locked));
      }
    };
    settle();
    window.addEventListener("resize", settle);
    return () => window.removeEventListener("resize", settle);
  }, [animator, locked]);

  return (
    <div className="relative overflow-x-auto">
      <div
        ref={listRef}
        role="tablist"
        aria-label="Session track"
        className="relative flex min-w-max gap-1"
        onMouseLeave={() => glideTo(locked)}
      >
        {tracks.map((track) => {
          const active = track.id === locked;
          return (
            <button
              key={track.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-track={track.id}
              disabled={disabled}
              title={track.title}
              onMouseEnter={() => glideTo(track.id)}
              onFocus={() => glideTo(track.id)}
              onClick={() => onLock(track.id)}
              className={`px-3 py-2.5 font-mono text-xs tracking-wider whitespace-nowrap transition-colors sm:text-sm ${
                active ? "text-quant" : "text-muted hover:text-ink"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              [ {track.ticker} ]
            </button>
          );
        })}
        <span
          ref={indicatorRef}
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-0 bg-quant opacity-0 shadow-[0_0_12px_rgb(34_211_238/0.8)]"
        />
      </div>
    </div>
  );
}
