"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type MouseEvent } from "react";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import { blockTime, cancelBooking, removeBlock, type ScheduleActionState } from "../actions/schedule";
import { Schedule } from "../services/Schedule";
import type { ScheduleEvent } from "../types";

const HOUR_PX = 44;
const DUBAI = new ZonedCalendar(Schedule.TIME_ZONE);

const STYLE: Record<ScheduleEvent["kind"], string> = {
  booking: "border-quant/60 bg-quant/15 text-ink",
  busy: "border-muted/40 bg-muted/15 text-muted",
  block: "border-gold/60 bg-[repeating-linear-gradient(135deg,rgb(212_175_55/0.18)_0_6px,transparent_6px_12px)] text-ink",
};

const LEGEND: { kind: ScheduleEvent["kind"]; label: string }[] = [
  { kind: "booking", label: "Website booking" },
  { kind: "busy", label: "Google / Apple calendar" },
  { kind: "block", label: "Blocked here" },
];

const midnight = (date: string) => Date.parse(`${date}T00:00:00${Schedule.OFFSET}`);
const time = (iso: string) => DUBAI.timeOf(new Date(iso));
const dayLabel = (date: string, style: "short" | "long") =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: style,
    day: "numeric",
    month: "short",
  });

/** Minutes after Dubai midnight of `date` covered by the event, or null when it misses that day. */
function span(event: ScheduleEvent, date: string): { from: number; to: number } | null {
  const day = midnight(date);
  const from = Math.max(Date.parse(event.start), day);
  const to = Math.min(Date.parse(event.end), day + 86_400_000);
  return to > from ? { from: (from - day) / 60_000, to: (to - day) / 60_000 } : null;
}

const pad = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * Week view of everything that makes the owner unavailable, plus the block-time
 * form. Clicking an empty spot prefills the form with that half hour.
 */
export function ScheduleBoard({ weekStart, today, events }: { weekStart: string; today: string; events: ScheduleEvent[] }) {
  const days = Array.from({ length: 7 }, (_, i) => ZonedCalendar.addDays(weekStart, i));
  const visible = events.filter((e) => e.status !== "cancelled");

  // Hours shown: 08-22, widened to fit whatever is on the calendar.
  let first = 8;
  let last = 22;
  for (const e of visible)
    for (const d of days) {
      const s = span(e, d);
      if (s) {
        first = Math.min(first, Math.floor(s.from / 60));
        last = Math.max(last, Math.ceil(s.to / 60));
      }
    }
  const hours = Array.from({ length: last - first }, (_, i) => first + i);

  const [form, setForm] = useState({ date: today, from: "09:00", to: "10:00", allDay: false });
  const [selected, setSelected] = useState<ScheduleEvent | null>(null);
  const [state, submit] = useActionState(blockTime, null);

  function pick(date: string, event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const minutes = Math.min(first * 60 + Math.floor(y / HOUR_PX / 0.5) * 30, 23 * 60);
    setForm({ date, from: pad(minutes), to: pad(Math.min(minutes + 60, 23 * 60 + 59)), allDay: false });
    setSelected(null);
    document.getElementById("block-form")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-label="Week" className="min-w-0">
        <ul className="mb-3 flex flex-wrap gap-4 text-xs text-muted">
          {LEGEND.map((l) => (
            <li key={l.kind} className="flex items-center gap-2">
              <span aria-hidden className={`inline-block h-3 w-4 rounded-sm border ${STYLE[l.kind]}`} />
              {l.label}
            </li>
          ))}
        </ul>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <div className="grid min-w-[44rem] grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
            <div className="border-b border-line" />
            {days.map((d) => (
              <div
                key={d}
                className={`border-b border-l border-line px-2 py-2 text-xs ${d === today ? "text-quant" : "text-muted"}`}
              >
                {dayLabel(d, "short")}
              </div>
            ))}

            <div className="relative" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h, i) => (
                <span key={h} className="absolute right-1 font-mono text-[10px] text-muted" style={{ top: i * HOUR_PX - 6 }}>
                  {i === 0 ? "" : pad(h * 60)}
                </span>
              ))}
            </div>

            {days.map((d) => (
              <div
                key={d}
                role="presentation"
                onClick={(e) => pick(d, e)}
                title="Click to block this time"
                className={`relative cursor-cell border-l border-line ${d < today ? "bg-canvas/40" : ""}`}
                style={{
                  height: hours.length * HOUR_PX,
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--color-line) 0 1px, transparent 1px ${HOUR_PX}px)`,
                }}
              >
                {visible.map((e) => {
                  const s = span(e, d);
                  if (!s) return null;
                  const top = ((s.from - first * 60) / 60) * HOUR_PX;
                  const height = Math.max(((s.to - s.from) / 60) * HOUR_PX - 2, 18);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelected(e)}
                      aria-pressed={selected?.id === e.id}
                      className={`absolute inset-x-1 overflow-hidden rounded border px-1.5 py-0.5 text-left text-[11px] leading-tight aria-pressed:ring-2 aria-pressed:ring-ink/60 ${STYLE[e.kind]}`}
                      style={{ top, height }}
                    >
                      <span className="block truncate font-medium">{e.title}</span>
                      {height > 30 && <span className="block truncate opacity-80">{time(e.start)}–{time(e.end)}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">Times in Dubai ({DUBAI.abbreviation()}). Click an empty spot to block it.</p>
      </section>

      <aside className="grid content-start gap-6">
        {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}

        <form id="block-form" action={submit} className="grid gap-3 rounded-lg border border-line bg-surface p-4">
          <h2 className="font-serif text-lg italic">Block time</h2>
          <p className="text-xs text-muted">
            Hides these times from the booking widget on the website. For recurring commitments, add a repeating event in
            Google or Apple Calendar instead: Cal.com already reads those.
          </p>
          <label className="grid gap-1 text-sm">
            Date
            <input
              type="date"
              name="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="rounded-md border border-line bg-canvas px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allDay" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} />
            All day
          </label>
          {form.allDay ? (
            <label className="grid gap-1 text-sm">
              Until (optional, for several days)
              <input type="date" name="until" min={form.date} className="rounded-md border border-line bg-canvas px-3 py-2" />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                From
                <input
                  type="time"
                  name="from"
                  required
                  step={900}
                  value={form.from}
                  onChange={(e) => setForm({ ...form, from: e.target.value })}
                  className="rounded-md border border-line bg-canvas px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                To
                <input
                  type="time"
                  name="to"
                  required
                  step={900}
                  value={form.to}
                  onChange={(e) => setForm({ ...form, to: e.target.value })}
                  className="rounded-md border border-line bg-canvas px-3 py-2"
                />
              </label>
            </div>
          )}
          <label className="grid gap-1 text-sm">
            Label (only you see it)
            <input
              name="reason"
              maxLength={120}
              placeholder="Offline client, personal…"
              className="rounded-md border border-line bg-canvas px-3 py-2"
            />
          </label>
          <PendingButton pendingLabel="Blocking…" className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-canvas">
            Block time
          </PendingButton>
          {state && (
            <p role="status" className={`text-sm ${state.ok ? "text-quant" : "text-gold"}`}>
              {state.message}
            </p>
          )}
        </form>
      </aside>

      <section aria-label="This week" className="xl:col-span-2">
        <h2 className="font-serif text-lg italic">This week</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing booked or blocked.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {events.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelected(e)}
                  className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm hover:bg-surface-raised ${e.status === "cancelled" ? "opacity-50" : ""}`}
                >
                  <span aria-hidden className={`h-3 w-4 shrink-0 rounded-sm border ${STYLE[e.kind]}`} />
                  <span className="w-36 shrink-0 font-mono text-xs text-muted">
                    {dayLabel(DUBAI.dateOf(new Date(e.start)), "short")} {time(e.start)}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${e.status === "cancelled" ? "line-through" : ""}`}>{e.title}</span>
                  <span className="text-xs text-muted">{e.status === "cancelled" ? "cancelled" : e.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EventDetail({ event, onClose }: { event: ScheduleEvent; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ScheduleActionState>(null);
  const date = DUBAI.dateOf(new Date(event.start));
  const endDate = DUBAI.dateOf(new Date(Date.parse(event.end) - 1));

  return (
    <section aria-label="Selected" className="grid gap-3 rounded-lg border border-line bg-surface p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{event.title}</h2>
          <p className="text-muted">
            {dayLabel(date, "long")} · {time(event.start)}–{time(event.end)}
            {endDate !== date && ` (${dayLabel(endDate, "short")})`}
          </p>
          <p className="text-xs text-muted">{event.status === "cancelled" ? "Cancelled" : event.detail}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
          ✕
        </button>
      </div>

      {event.kind === "busy" && (
        <p className="text-xs text-muted">From your connected calendar. Edit or delete it there; Cal.com picks up changes automatically.</p>
      )}

      {event.kind === "block" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await removeBlock(event.id);
              onClose();
            })
          }
          className="justify-self-start rounded-md border border-line px-3 py-1.5 hover:border-gold disabled:opacity-60"
        >
          {pending ? "Removing…" : "Unblock"}
        </button>
      )}

      {event.kind === "booking" && (
        <>
          {event.email && (
            <a href={`mailto:${event.email}`} className="truncate text-quant hover:underline">
              {event.email}
            </a>
          )}
          {event.meetingUrl && event.status !== "cancelled" && (
            <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="text-quant hover:underline">
              Join meeting ↗
            </a>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/invoices/confirm?booking=${encodeURIComponent(event.id)}`} className="rounded-md border border-line px-3 py-1.5 hover:border-quant">
              Send confirmation
            </Link>
            <Link href={`/admin/invoices/new?booking=${encodeURIComponent(event.id)}`} className="rounded-md border border-line px-3 py-1.5 hover:border-quant">
              Create invoice
            </Link>
          </div>
          {event.status !== "cancelled" &&
            (confirming ? (
              <div className="grid gap-2 rounded-md border border-gold/40 p-3">
                <label className="grid gap-1">
                  Reason (sent to the client)
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="rounded-md border border-line bg-canvas px-3 py-2" />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(async () => setResult(await cancelBooking(event.id, reason)))}
                    className="rounded-md bg-gold px-3 py-1.5 font-medium text-canvas disabled:opacity-60"
                  >
                    {pending ? "Cancelling…" : "Cancel booking"}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="px-3 py-1.5 text-muted hover:text-ink">
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="justify-self-start text-xs text-muted hover:text-gold">
                Cancel this booking…
              </button>
            ))}
          {result && (
            <p role="status" className={result.ok ? "text-quant" : "text-gold"}>
              {result.message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
