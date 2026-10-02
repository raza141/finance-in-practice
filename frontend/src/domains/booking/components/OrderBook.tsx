"use client";

import { useRef, type KeyboardEvent } from "react";

import { TerminalFormat } from "../services/TerminalFormat";
import type { DayLiquidity, TimeSlot } from "../types";

interface OrderBookProps {
  day: DayLiquidity;
  selected: TimeSlot | null;
  /** Short label of the viewer's timezone, e.g. "GMT+4". */
  zoneLabel: string;
  onSelect: (slot: TimeSlot) => void;
}

/** Stage 3: available times as an L2 book (earlier half BID, later half ASK). */
export function OrderBook({ day, selected, zoneLabel, onSelect }: OrderBookProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[role=radio]") ?? []);
    const current = rows.indexOf(document.activeElement as HTMLElement);
    const next = rows[(current + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length];
    next?.focus();
  };

  return (
    <div className="tabular-data mt-5 rounded-lg border border-line bg-canvas/70 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[11px] tracking-wider">
          <span className="text-ink">
            L2 ORDER BOOK <span className="text-muted">· {TerminalFormat.weekday(day.date)}{" "}
            {TerminalFormat.date(day.date)}</span>
          </span>
          <span className="text-muted">{TerminalFormat.slots(day.slots.length)}</span>
        </div>

        <div className="grid grid-cols-[3.5rem_1fr_4rem_5.5rem] gap-2 px-4 py-2 text-[10px] tracking-wider text-muted">
          <span>SIDE</span>
          <span>TIME ({zoneLabel})</span>
          <span>SIZE</span>
          <span className="text-right">STATUS</span>
        </div>

        <div
          ref={listRef}
          role="radiogroup"
          aria-label={`Available times on ${TerminalFormat.date(day.date)}`}
          onKeyDown={onKeyDown}
          className="max-h-64 overflow-y-auto pb-2"
        >
          {day.slots.map((slot) => {
            const active = selected?.start === slot.start;
            return (
              <button
                key={slot.start}
                type="button"
                role="radio"
                aria-checked={active}
                data-book-row
                onClick={() => onSelect(slot)}
                className={`grid w-full grid-cols-[3.5rem_1fr_4rem_5.5rem] items-center gap-2 border-l-2 px-4 py-2 text-left transition-colors ${
                  active
                    ? "border-gold bg-gold/10 text-ink"
                    : "border-transparent text-ink/85 hover:bg-surface-raised"
                }`}
              >
                <span className={slot.side === "BID" ? "text-quant" : "text-muted"}>{slot.side}</span>
                <span className="text-sm">
                  {slot.label} <span className="text-muted">{zoneLabel}</span>
                </span>
                <span className="text-muted">{slot.durationMinutes}m</span>
                <span className={`text-right ${active ? "text-gold" : "text-muted"}`}>
                  {active ? "● LOCKED" : "OPEN"}
                </span>
              </button>
            );
          })}
        </div>
    </div>
  );
}
