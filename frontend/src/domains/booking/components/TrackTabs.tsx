"use client";

import type { BookingTrack, TrackId } from "../types";

interface TrackTabsProps {
  tracks: readonly BookingTrack[];
  locked: TrackId | null;
  disabled?: boolean;
  onLock: (id: TrackId) => void;
}

/** Stage 1: pick a session track. Bordered cards with a radio dot so the choice reads as clickable. */
export function TrackTabs({ tracks, locked, disabled = false, onLock }: TrackTabsProps) {
  return (
    <fieldset disabled={disabled} className="disabled:opacity-60">
      <legend className="mb-2 text-xs tracking-widest text-muted">
        {locked ? "SESSION TRACK" : "1 · PICK YOUR COURSE"}
      </legend>
      <div role="radiogroup" aria-label="Session track" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tracks.map((track) => {
          const active = track.id === locked;
          return (
            <button
              key={track.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={track.title}
              onClick={() => onLock(track.id)}
              className={`group flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed ${
                active
                  ? "border-quant bg-quant/10 shadow-[0_0_16px_-4px_rgb(34_211_238/0.6)]"
                  : "border-line bg-canvas/40 hover:border-quant/60 hover:bg-white/5"
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${
                  active ? "border-quant" : "border-muted group-hover:border-quant/70"
                }`}
              >
                {active && <span className="h-1.5 w-1.5 rounded-full bg-quant" />}
              </span>
              <span className="min-w-0">
                <span className={`block text-xs font-semibold tracking-wider sm:text-sm ${active ? "text-quant" : "text-ink"}`}>
                  {track.ticker}
                </span>
                <span className="mt-0.5 block font-sans text-xs leading-snug text-muted">{track.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
