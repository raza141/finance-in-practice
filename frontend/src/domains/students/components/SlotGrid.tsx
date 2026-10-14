"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

import type { SlotWire } from "@/domains/booking/services/BookingContract";
import type { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import { StudentBookingContract } from "../services/StudentBookingContract";

export interface SlotSelection {
  start: string;
  minutes: number;
}

const PAGE = 7;

/** Same classes as the cells below. */
const LEGEND = [
  ["bg-gold", "Your selection"],
  ["bg-quant/10", "Available"],
  ["bg-canvas/40", "Busy or unavailable"],
] as const;
const dayLabel = (iso: string, part: "weekday" | "day") =>
  new Intl.DateTimeFormat("en-GB", part === "weekday" ? { weekday: "short", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

/**
 * Week grid of free hours, Google Calendar style: click an hour, or drag down
 * (mouse) to book up to the longest allowed length. `fixedMinutes` (moving an
 * existing session) only offers starts where that length fits.
 */
export function SlotGrid({
  days,
  calendar,
  lengths,
  fixedMinutes,
  value,
  onChange,
}: {
  days: { date: string; slots: SlotWire[] }[];
  calendar: ZonedCalendar;
  lengths: readonly number[];
  fixedMinutes?: number;
  value: SlotSelection | null;
  onChange: (selection: SlotSelection | null) => void;
}) {
  const [page, setPage] = useState(0);
  const drag = useRef<{ date: string; index: number } | null>(null);
  const pointer = useRef<string>("mouse");
  const maxHours = Math.max(...lengths) / 60;
  const visible = days.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.ceil(days.length / PAGE);

  useEffect(() => {
    const stop = () => (drag.current = null);
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const timeOf = (iso: string) => calendar.timeOf(new Date(iso));
  const rows = [...new Set(visible.flatMap((d) => d.slots.map((s) => timeOf(s.start))))].sort();
  const run = (slots: SlotWire[], index: number) => StudentBookingContract.runLength(slots, index, maxHours);
  const fits = (slots: SlotWire[], index: number) => !fixedMinutes || run(slots, index) * 60 >= fixedMinutes;

  const select = (slots: SlotWire[], index: number, minutes: number) => onChange({ start: slots[index].start, minutes });
  const startAt = (day: { slots: SlotWire[] }, index: number) => {
    if (!fits(day.slots, index)) return;
    // Keep the chosen length when it still fits at the new start.
    const keep = value && run(day.slots, index) * 60 >= value.minutes ? value.minutes : 60;
    select(day.slots, index, fixedMinutes ?? keep);
  };

  const onDown = (event: PointerEvent, day: { date: string; slots: SlotWire[] }, index: number) => {
    pointer.current = event.pointerType;
    if (event.pointerType === "touch" || fixedMinutes || !fits(day.slots, index)) return;
    drag.current = { date: day.date, index };
    select(day.slots, index, 60);
  };
  const onEnter = (day: { date: string; slots: SlotWire[] }, index: number) => {
    const from = drag.current;
    if (!from || from.date !== day.date || index < from.index) return;
    const hours = Math.min(index - from.index + 1, run(day.slots, from.index));
    if (lengths.includes(hours * 60)) select(day.slots, from.index, hours * 60);
  };

  const selectedDay = value ? calendar.dateOf(new Date(value.start)) : null;
  const inSelection = (date: string, slots: SlotWire[], index: number) => {
    if (!value || date !== selectedDay) return false;
    const first = slots.findIndex((s) => s.start === value.start);
    return first !== -1 && index >= first && index < first + value.minutes / 60;
  };
  const selectedRun = value && selectedDay ? (() => {
    const day = days.find((d) => d.date === selectedDay);
    const index = day?.slots.findIndex((s) => s.start === value.start) ?? -1;
    return day && index !== -1 ? run(day.slots, index) : 0;
  })() : 0;

  return (
    <div className="grid gap-3">
      <ul aria-label="Colours" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {LEGEND.map(([swatch, label]) => (
          <li key={label} className="flex items-center gap-1.5">
            {/* On the grid's own background, so the sample matches the cells exactly. */}
            <span aria-hidden className="overflow-hidden rounded-sm bg-line">
              <span className={`block h-3 w-4 ${swatch}`} />
            </span>
            {label}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>Times in {calendar.abbreviation()}</span>
        {pages > 1 && (
          <span className="flex gap-1">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Earlier days" className="rounded border border-line px-2 py-1 hover:border-quant/50 disabled:opacity-30">
              ←
            </button>
            <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Later days" className="rounded border border-line px-2 py-1 hover:border-quant/50 disabled:opacity-30">
              →
            </button>
          </span>
        )}
      </div>

      <div
        role="grid"
        aria-label="Free times"
        className="grid gap-px overflow-hidden rounded-xl border border-line bg-line select-none"
        style={{ gridTemplateColumns: `3rem repeat(${visible.length}, minmax(0, 1fr))` }}
      >
        <div className="bg-canvas" />
        {visible.map((d) => (
          <div key={d.date} role="columnheader" className="bg-canvas px-1 py-2 text-center">
            <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase">{dayLabel(d.date, "weekday")}</p>
            <p className="text-xs font-semibold text-ink">{dayLabel(d.date, "day")}</p>
          </div>
        ))}
        {rows.map((time) => (
          <div key={time} role="row" className="contents">
            <div className="bg-canvas py-2 pr-2 text-right font-mono text-[10px] text-muted">{time}</div>
            {visible.map((d) => {
              const index = d.slots.findIndex((s) => timeOf(s.start) === time);
              if (index === -1) return <div key={d.date} aria-hidden className="bg-canvas/40" />;
              const selected = inSelection(d.date, d.slots, index);
              const first = selected && d.slots[index].start === value?.start;
              const usable = fits(d.slots, index);
              return (
                <button
                  key={d.date}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  aria-label={`${dayLabel(d.date, "weekday")} ${dayLabel(d.date, "day")} ${time}`}
                  disabled={!usable}
                  onPointerDown={(e) => onDown(e, d, index)}
                  onPointerEnter={() => onEnter(d, index)}
                  onClick={() => pointer.current === "touch" || fixedMinutes ? startAt(d, index) : undefined}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), startAt(d, index))}
                  className={`h-9 px-1 text-left font-mono text-[10px] transition-colors ${
                    selected
                      ? "bg-gold text-canvas"
                      : usable
                        ? "bg-quant/10 text-quant hover:bg-quant/25"
                        : "bg-canvas/40 text-muted/40"
                  }`}
                >
                  {first && value && `${time}–${timeOf(new Date(Date.parse(value.start) + value.minutes * 60_000).toISOString())}`}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {!fixedMinutes && value && (
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Length">
          <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Length</span>
          {lengths.map((minutes) => {
            const active = value.minutes === minutes;
            return (
              <button
                key={minutes}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={minutes / 60 > selectedRun}
                onClick={() => onChange({ ...value, minutes })}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-30 ${
                  active ? "border-gold bg-gold/15 text-gold" : "border-line text-ink/90 hover:border-quant/50"
                }`}
              >
                {minutes / 60} h
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
