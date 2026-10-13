"use client";

import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "@/core/http/ApiError";
import type { CreateBookingResponse, SlotWire } from "@/domains/booking/services/BookingContract";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import { StudentApiClient } from "../services/StudentApiClient";
import { StudentBookingContract } from "../services/StudentBookingContract";
import type { SessionMode } from "../types";

const DAYS = 14;
const FIELD =
  "w-full rounded-md border border-line bg-canvas/80 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-quant/70 disabled:opacity-60";
const LABEL = "font-mono text-[11px] tracking-[0.22em] text-muted uppercase";
const CHIP = "rounded-md border px-3 py-2 font-mono text-xs transition-colors";
const chip = (active: boolean) =>
  `${CHIP} ${active ? "border-quant bg-quant/15 text-quant" : "border-line text-ink/90 hover:border-quant/50"}`;

const client = new StudentApiClient();
const { OTHER, LIMITS } = StudentBookingContract;

type Days = { status: "loading" } | { status: "ready"; days: { date: string; slots: SlotWire[] }[] } | { status: "error"; message: string };
type Phase = { kind: "editing"; error?: string } | { kind: "sending" } | { kind: "done"; booking: CreateBookingResponse };

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : "Something went wrong. Please retry.");

/** Course, place, date and time for a signed-in student's 1-on-1 session. */
export function StudentBookingForm({ courses, minutes }: { courses: string[]; minutes: number }) {
  const [timeZone, setTimeZone] = useState("Asia/Dubai");
  const [days, setDays] = useState<Days>({ status: "loading" });
  const [course, setCourse] = useState(courses.length === 1 ? courses[0] : "");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<SessionMode>("online");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "editing" });

  useEffect(() => {
    const zone = ZonedCalendar.visitorTimeZone();
    const from = new ZonedCalendar(zone).today();
    let live = true;
    client
      .slots(from, ZonedCalendar.addDays(from, DAYS - 1), zone)
      .then((range) => live && (setTimeZone(zone), setDays({ status: "ready", days: range.days.filter((d) => d.slots.length > 0) })))
      .catch((error) => live && setDays({ status: "error", message: messageOf(error) }));
    return () => {
      live = false;
    };
  }, []);

  const calendar = new ZonedCalendar(timeZone);
  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const slots = days.status === "ready" ? (days.days.find((d) => d.date === date)?.slots ?? []) : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!start) return setPhase({ kind: "editing", error: "Pick a date and time." });
    setPhase({ kind: "sending" });
    try {
      const booking = await client.book({ start, timeZone, course, topic, mode, address, notes });
      setPhase({ kind: "done", booking });
    } catch (error) {
      setPhase({ kind: "editing", error: messageOf(error) });
    }
  }

  if (phase.kind === "done") {
    const when = new Date(phase.booking.start);
    const pending = phase.booking.status.toLowerCase() !== "accepted";
    return (
      <div role="status" className="rounded-2xl border border-quant/40 bg-quant/5 p-6">
        <p className={LABEL}>{pending ? "Requested" : "Booked"}</p>
        <p className="mt-3 text-xl text-ink">
          {dayLabel(calendar.dateOf(when))} · {calendar.timeOf(when)} ({calendar.abbreviation(when)})
        </p>
        <p className="mt-2 text-sm text-muted">
          {pending
            ? "Your request is in. You'll get an email as soon as it's confirmed."
            : "Cal.com has emailed you the details and a calendar invite."}
        </p>
        <button type="button" onClick={() => window.location.reload()} className="mt-5 text-sm text-quant hover:underline">
          Book another session
        </button>
      </div>
    );
  }

  const sending = phase.kind === "sending";
  return (
    <form onSubmit={submit} className="grid gap-6">
      <fieldset disabled={sending} className="grid gap-6">
        <label className="grid gap-2">
          <span className={LABEL}>Course</span>
          <select required value={course} onChange={(e) => setCourse(e.target.value)} className={FIELD}>
            <option value="" disabled>
              Choose a course
            </option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={OTHER}>Other (tell us below)</option>
          </select>
        </label>
        {course === OTHER && (
          <label className="grid gap-2">
            <span className={LABEL}>What should we cover?</span>
            <input
              required
              minLength={LIMITS.topic[0]}
              maxLength={LIMITS.topic[1]}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Fixed income duration questions"
              className={FIELD}
            />
          </label>
        )}

        <div className="grid gap-2">
          <span className={LABEL}>Where</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where">
            {(
              [
                ["online", "Online · Google Meet"],
                ["in_person", "In person · Abu Dhabi"],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => setMode(value)} className={chip(mode === value)}>
                {label}
              </button>
            ))}
          </div>
          {mode === "in_person" && (
            <input
              required
              minLength={LIMITS.address[0]}
              maxLength={LIMITS.address[1]}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Area, building and flat in Abu Dhabi"
              aria-label="Address in Abu Dhabi"
              className={FIELD}
            />
          )}
        </div>

        <div className="grid gap-2">
          <span className={LABEL}>Date · {minutes} min</span>
          {days.status === "loading" && <p className="text-sm text-muted">Loading free times…</p>}
          {days.status === "error" && <p role="alert" className="text-sm text-gold">{days.message}</p>}
          {days.status === "ready" && days.days.length === 0 && (
            <p className="text-sm text-muted">No free times in the next {DAYS} days. Message on WhatsApp and we&rsquo;ll find one.</p>
          )}
          {days.status === "ready" && (
            <div className="flex flex-wrap gap-2">
              {days.days.map((d) => (
                <button key={d.date} type="button" aria-pressed={date === d.date} onClick={() => (setDate(d.date), setStart(null))} className={chip(date === d.date)}>
                  {dayLabel(d.date)}
                </button>
              ))}
            </div>
          )}
        </div>

        {date && (
          <div className="grid gap-2">
            <span className={LABEL}>Time ({calendar.abbreviation()})</span>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button key={s.start} type="button" aria-pressed={start === s.start} onClick={() => setStart(s.start)} className={chip(start === s.start)}>
                  {calendar.timeOf(new Date(s.start))}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="grid gap-2">
          <span className={LABEL}>Notes (optional)</span>
          <textarea rows={3} maxLength={LIMITS.notes} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Readings, questions or a mock you want to go through" className={`${FIELD} resize-y`} />
        </label>
      </fieldset>

      {phase.kind === "editing" && phase.error && (
        <p role="alert" className="text-sm text-gold">
          {phase.error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending || !start || !course}
        className="inline-flex h-12 items-center justify-center rounded-md bg-gold px-6 font-mono text-[15px] font-semibold text-canvas transition-colors hover:bg-gold-bright disabled:opacity-50"
      >
        {sending ? "Booking…" : "Book session"}
      </button>
    </form>
  );
}
