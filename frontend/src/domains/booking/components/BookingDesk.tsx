"use client";

import { useState, type ReactNode } from "react";

import { TiltSurface } from "@/core/components/ui/TiltSurface";

import type { BookingSelection } from "../types";
import { QuantBookingWidget } from "./QuantBookingWidget";

const EMPTY: BookingSelection = { course: null, date: null, time: null, booked: false };

/**
 * Widget plus a live "Your session" summary (Apple's sticky buy-page sidebar):
 * every pick shows up beside the form at once, so nobody wonders what they chose.
 */
export function BookingDesk({ heading }: { heading: ReactNode }) {
  const [selection, setSelection] = useState<BookingSelection>(EMPTY);
  const rows = [
    { label: "Course", value: selection.course, placeholder: "Pick a course" },
    { label: "Date", value: selection.date, placeholder: "Pick a day" },
    { label: "Time", value: selection.time, placeholder: "Pick a time" },
    { label: "Cost", value: "Free · 30 min · no card", placeholder: "" },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="min-w-0 lg:col-span-4">
        <div className="lg:sticky lg:top-28">
          {heading}
          <div data-anim="reveal" className="mt-8 rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs tracking-[0.16em] text-muted uppercase">Your session</p>
              {selection.booked && <p className="text-xs font-semibold text-gold">Booked ✓</p>}
            </div>
            <ul className="mt-4 divide-y divide-line">
              {rows.map((row) => (
                <li key={row.label} className="flex items-center gap-3 py-3">
                  <span
                    aria-hidden
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] transition-colors ${row.value ? "border-gold bg-gold text-canvas" : "border-line text-transparent"}`}
                  >
                    ✓
                  </span>
                  <span className="w-16 shrink-0 text-sm text-muted">{row.label}</span>
                  <span aria-live="polite" className={`min-w-0 truncate text-sm ${row.value ? "font-semibold text-ink" : "text-muted/70"}`}>
                    {row.value ?? row.placeholder}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">You leave with a clear study plan.</p>
          </div>
        </div>
      </div>

      <div data-anim="reveal" className="min-w-0 lg:col-span-8">
        <TiltSurface maxTilt={2.5}>
          <QuantBookingWidget onSelection={setSelection} />
        </TiltSurface>
      </div>
    </div>
  );
}
