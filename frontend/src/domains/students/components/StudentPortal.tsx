"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { ApiError } from "@/core/http/ApiError";
import type { SlotWire } from "@/domains/booking/services/BookingContract";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { markFeedSeen } from "@/domains/classroom/actions/classroom";

import { StudentApiClient } from "../services/StudentApiClient";
import { StudentBookingContract } from "../services/StudentBookingContract";
import type { SessionMode, StudentSession } from "../types";
import { BUTTON, JOIN_BUTTON } from "./buttons";
import { SlotGrid, type SlotSelection } from "./SlotGrid";

const DAYS = 14;
const FIELD =
  "w-full rounded-md border border-line bg-canvas/80 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-quant/70 disabled:opacity-60";
const LABEL = "font-mono text-[11px] tracking-[0.22em] text-muted uppercase";
const CARD = "rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md";
const chip = (active: boolean) =>
  `rounded-md border px-3 py-2 font-mono text-xs transition-colors ${active ? "border-quant bg-quant/15 text-quant" : "border-line text-ink/90 hover:border-quant/50"}`;

const client = new StudentApiClient();
const { OTHER, LIMITS } = StudentBookingContract;

type Days = { status: "loading" } | { status: "ready"; days: { date: string; slots: SlotWire[] }[] } | { status: "error"; message: string };
type Notice = { tone: "ok" | "warn"; text: string } | null;
export type Tab = "overview" | "book" | "sessions" | "account" | "plan" | "classroom" | "progress";

/** Lets server-rendered panels (overview, progress) switch tabs; `notes` pre-fills the booking form. */
const PortalTabs = createContext<(tab: Tab, notes?: string) => void>(() => {});

export function TabButton({ tab, notes, className, children }: { tab: Tab; notes?: string; className?: string; children: ReactNode }) {
  const go = use(PortalTabs);
  return (
    <button type="button" onClick={() => go(tab, notes)} className={className}>
      {children}
    </button>
  );
}

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : "Something went wrong. Please retry.");
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const hours = (minutes: number) => `${minutes / 60} h`;

/**
 * The signed-in student's portal. Left: who they are, a live preview of the
 * session they're building, and their upcoming sessions (change or cancel).
 * Right: course, place, a drag-to-select week grid and notes.
 */
export function StudentPortal({
  courses,
  lengths,
  sessions,
  past,
  addresses,
  plan,
  account,
  classroom,
  overview,
  progress,
  readOnly = false,
}: {
  courses: string[];
  lengths: readonly number[];
  sessions: StudentSession[] | null;
  past: StudentSession[];
  addresses: string[];
  /** The study plan and materials tab, rendered on the server. */
  plan: ReactNode;
  /** Hours studied, money paid and owed, next month: rendered on the server. */
  account: ReactNode;
  /** The Classroom tab, rendered on the server; null hides the tab. */
  classroom: ReactNode | null;
  /** The first tab: next session, to-do, latest mark and what's new. */
  overview: ReactNode;
  /** Mock scores from Classroom; null hides the tab. */
  progress: ReactNode | null;
  /** An admin viewing as this student: shown as they see it, but nothing is booked, changed or marked seen. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [timeZone, setTimeZone] = useState("Asia/Dubai");
  const [days, setDays] = useState<Days>(
    readOnly ? { status: "error", message: "Free times load only for the student (you are viewing as them)." } : { status: "loading" },
  );
  const [course, setCourse] = useState(courses[0] ?? "");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<SessionMode>("online");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [locating, setLocating] = useState<"idle" | "busy" | "failed">("idle");
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const [moving, setMoving] = useState<StudentSession | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const seen = useRef(false);
  const [notice, setNotice] = useState<Notice>(null);
  // Bumped after each change so the grid re-reads free times.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (readOnly) return;
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
  }, [version, readOnly]);

  const calendar = new ZonedCalendar(timeZone);
  const when = (start: string, minutes: number) => {
    const from = new Date(start);
    const to = new Date(from.getTime() + minutes * 60_000);
    return `${dayLabel(calendar.dateOf(from))} · ${calendar.timeOf(from)}–${calendar.timeOf(to)}`;
  };
  const chooseMode = (next: SessionMode) => {
    setMode(next);
    if (next === "in_person" && !address && addresses[0]) setAddress(addresses[0]);
  };
  // Free: the browser's own location, turned into a Google Maps link. No map API or key involved.
  const dropPin = () => {
    if (!navigator.geolocation) return setLocating("failed");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => (setMapUrl(StudentBookingContract.pinLink(coords.latitude, coords.longitude)), setLocating("idle")),
      () => setLocating("failed"),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };
  const mapLinkInvalid = mapUrl !== "" && !StudentBookingContract.isMapLink(mapUrl);

  const done = (text: string) => {
    setNotice({ tone: "ok", text });
    setSelection(null);
    setMoving(null);
    setTab("sessions");
    setVersion((v) => v + 1);
    router.refresh();
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selection) return setNotice({ tone: "warn", text: "Pick a time on the calendar." });
    setBusy(true);
    setNotice(null);
    try {
      if (moving) {
        await client.reschedule(moving.uid, selection.start);
        done(`Moved to ${when(selection.start, moving.minutes)}. Cal.com has emailed you the new time.`);
      } else {
        const booking = await client.book({ start: selection.start, timeZone, course, topic, mode, address, notes, mapUrl, minutes: selection.minutes });
        done(
          booking.status.toLowerCase() === "accepted"
            ? `Booked: ${when(selection.start, selection.minutes)}. Cal.com has emailed you the invite.`
            : "Requested. You'll get an email as soon as it's confirmed.",
        );
        setNotes("");
      }
    } catch (error) {
      setNotice({ tone: "warn", text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }

  async function cancel(session: StudentSession) {
    setBusy(true);
    setNotice(null);
    try {
      await client.cancel(session.uid);
      setConfirmCancel(null);
      done(`Cancelled ${when(session.start, session.minutes)}.`);
    } catch (error) {
      setNotice({ tone: "warn", text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }

  const startMoving = (session: StudentSession) => {
    setMoving(session);
    setSelection(null);
    setNotice(null);
    setTab("book");
  };

  const courseLabel = course === OTHER ? (topic ? `Other: ${topic}` : "Other") : course;
  const where = mode === "online" ? "Online · Google Meet" : address || "In person · Abu Dhabi (add the address)";
  const noticeEl = notice && (
    <p role={notice.tone === "ok" ? "status" : "alert"} className={`text-sm ${notice.tone === "ok" ? "text-quant" : "text-gold"}`}>
      {notice.text}
    </p>
  );
  const TABS: [Tab, string][] = [
    ["overview", "Overview"],
    ["book", moving ? "Change a session" : "Book a session"],
    ["sessions", `My sessions${sessions?.length ? ` (${sessions.length})` : ""}`],
    ["account", "Hours & payments"],
    ...(classroom ? ([["classroom", "Classroom"]] as [Tab, string][]) : []),
    ...(progress ? ([["progress", "Progress"]] as [Tab, string][]) : []),
    ["plan", "Study plan & materials"],
  ];
  const go = (next: Tab, prefill?: string) => {
    setTab(next);
    if (prefill) setNotes(prefill);
    // Opening the class feed once per visit: what's there now stops being "New" next time.
    if (next === "classroom" && !seen.current && !readOnly) {
      seen.current = true;
      void markFeedSeen().catch(() => {});
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <PortalTabs value={go}>
    <div className="grid gap-6">
      <nav aria-label="Student portal" className="sticky top-16 z-20 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-canvas/90 p-1.5 backdrop-blur-md">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? "page" : undefined}
            onClick={() => go(id)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm whitespace-nowrap transition-colors ${
              tab === id ? "bg-quant/15 font-semibold text-quant" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && overview}
      {tab === "plan" && plan}
      {tab === "account" && account}
      {tab === "classroom" && classroom}
      {tab === "progress" && progress}

      {tab === "sessions" && (
        <div className="grid gap-6">
          <section aria-labelledby="sessions-heading" className={`${CARD} sm:p-8`}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="sessions-heading" className="text-2xl font-normal italic">
                Upcoming sessions
              </h2>
              <button type="button" onClick={() => setTab("book")} className="text-sm text-quant hover:underline">
                + Book another
              </button>
            </div>
            {noticeEl && <div className="mt-3">{noticeEl}</div>}
            {sessions === null ? (
              <p className="mt-3 text-sm text-muted">Couldn&rsquo;t load your sessions right now. Your confirmation emails have every detail.</p>
            ) : sessions.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing booked yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line/60">
                {sessions.map((s) => (
                  <li key={s.uid} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4 text-sm">
                    <div>
                      <p className="font-semibold text-ink">{when(s.start, s.minutes)}</p>
                      <p className="text-muted">
                        {s.group && (
                          <span className="mr-2 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">Group session</span>
                        )}
                        {s.course} · {hours(s.minutes)} · {s.address ?? "Online"}
                        {s.status === "pending" && <span className="text-gold"> · awaiting confirmation</span>}
                      </p>
                    </div>
                    {s.group ? (
                      <p className="flex flex-wrap items-center gap-4">
                        {s.meetingUrl && (
                          <a href={s.meetingUrl} target="_blank" rel="noreferrer" className={JOIN_BUTTON}>
                            Join session
                          </a>
                        )}
                        <span className="text-xs text-muted">Shared with your batch: message your instructor to change it.</span>
                      </p>
                    ) : confirmCancel === s.uid ? (
                      <p className="flex flex-wrap items-center gap-3">
                        <span className="text-ink">Cancel this session?</span>
                        <button type="button" disabled={busy} onClick={() => cancel(s)} className="text-red-300 hover:underline disabled:opacity-50">
                          {busy ? "Cancelling…" : "Yes, cancel"}
                        </button>
                        <button type="button" onClick={() => setConfirmCancel(null)} className="text-muted hover:text-ink">
                          Keep it
                        </button>
                      </p>
                    ) : (
                      <p className="flex flex-wrap gap-4">
                        {s.meetingUrl && (
                          <a href={s.meetingUrl} target="_blank" rel="noreferrer" className={JOIN_BUTTON}>
                            Join session
                          </a>
                        )}
                        <button type="button" disabled={readOnly} onClick={() => startMoving(s)} className={`${BUTTON} disabled:opacity-50`}>
                          Change time
                        </button>
                        <button type="button" disabled={readOnly} onClick={() => setConfirmCancel(s.uid)} className="text-muted hover:text-red-300 disabled:opacity-50">
                          Cancel
                        </button>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">Every booking, change and cancellation is emailed to you and your instructor.</p>
          </section>

          {past.length > 0 && (
            <section aria-labelledby="past-heading" className={`${CARD} sm:p-8`}>
              <h2 id="past-heading" className={LABEL}>
                Past sessions
              </h2>
              <ul className="mt-3 divide-y divide-line/60 text-sm">
                {past.map((s) => (
                  <li key={s.uid} className="flex flex-wrap justify-between gap-x-6 py-2.5">
                    <span className="text-ink/90">{when(s.start, s.minutes)}</span>
                    <span className="text-muted">
                      {s.course} · {hours(s.minutes)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === "book" && (
        <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
          <aside className="grid gap-6 lg:sticky lg:top-40">
            <section aria-labelledby="preview-heading" className={CARD}>
              <h2 id="preview-heading" className={LABEL}>
                {moving ? "Moving this session" : "Your session"}
              </h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Course</dt>
                  <dd className="font-semibold text-ink">{moving ? moving.course : courseLabel || "—"}</dd>
                </div>
                {moving && (
                  <div>
                    <dt className="text-xs text-muted">Now</dt>
                    <dd className="text-ink/80 line-through">{when(moving.start, moving.minutes)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted">{moving ? "New time" : "When"}</dt>
                  <dd className={selection ? "font-semibold text-gold" : "text-muted"}>
                    {selection ? `${when(selection.start, moving?.minutes ?? selection.minutes)} (${hours(moving?.minutes ?? selection.minutes)})` : "Pick a time on the calendar"}
                  </dd>
                </div>
                {!moving && (
                  <div>
                    <dt className="text-xs text-muted">Location</dt>
                    <dd className="text-ink">{where}</dd>
                    {mode === "in_person" && mapUrl && !mapLinkInvalid && <dd className="text-xs text-quant">Map pin added ✓</dd>}
                  </div>
                )}
                {!moving && notes && (
                  <div>
                    <dt className="text-xs text-muted">Notes</dt>
                    <dd className="whitespace-pre-line text-ink/80">{notes}</dd>
                  </div>
                )}
              </dl>
            </section>

          </aside>

          <form id="booking-panel" onSubmit={submit} className={`${CARD} grid gap-6 sm:p-8`}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-2xl font-normal italic">{moving ? "Pick a new time" : "Book a session"}</h2>
              {moving && (
                <button type="button" onClick={() => (setMoving(null), setSelection(null))} className="text-sm text-muted hover:text-ink">
                  Stop changing
                </button>
              )}
            </div>

            <fieldset disabled={busy} className="grid gap-6">
              {!moving && (
                <>
                  <label className="grid gap-2">
                    <span className={LABEL}>Course</span>
                    <select required value={course} onChange={(e) => setCourse(e.target.value)} className={FIELD}>
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
                        placeholder="e.g. AP Statistics: hypothesis tests"
                        className={FIELD}
                      />
                    </label>
                  )}

                  <div className="grid gap-2">
                    <span className={LABEL}>Location</span>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Location">
                      {(
                        [
                          ["online", "Online · Google Meet"],
                          ["in_person", "In person · Abu Dhabi"],
                        ] as const
                      ).map(([value, label]) => (
                        <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => chooseMode(value)} className={chip(mode === value)}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {mode === "in_person" && (
                      <div className="grid gap-2">
                        {addresses.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-muted">Used before:</span>
                            {addresses.map((a) => (
                              <button key={a} type="button" onClick={() => setAddress(a)} className={chip(address === a)}>
                                {a}
                              </button>
                            ))}
                          </div>
                        )}
                        <input
                          required
                          minLength={LIMITS.address[0]}
                          maxLength={LIMITS.address[1]}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Area, building and flat/villa in Abu Dhabi"
                          aria-label="Address in Abu Dhabi"
                          className={FIELD}
                        />
                        <div className="grid gap-2 rounded-xl border border-dashed border-line p-3">
                          <p className="text-xs text-muted">Map pin (optional): helps me find the exact building.</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={dropPin} disabled={locating === "busy"} className={chip(false)}>
                              {locating === "busy" ? "Finding you…" : "📍 Use my current location"}
                            </button>
                            <span className="text-xs text-muted">or</span>
                            <input
                              type="url"
                              inputMode="url"
                              maxLength={LIMITS.mapUrl}
                              value={mapUrl}
                              onChange={(e) => setMapUrl(e.target.value.trim())}
                              placeholder="Paste a Google Maps link"
                              aria-label="Google Maps link"
                              aria-invalid={mapLinkInvalid}
                              className={`${FIELD} min-w-48 flex-1 py-2`}
                            />
                          </div>
                          {locating === "failed" && <p className="text-xs text-gold">Couldn&rsquo;t get your location. Allow location access, or paste a Google Maps link.</p>}
                          {mapLinkInvalid && <p className="text-xs text-gold">That isn&rsquo;t a Google Maps link. In Google Maps, tap Share and copy the link.</p>}
                          <p className="flex flex-wrap gap-4 text-xs">
                            {mapUrl && !mapLinkInvalid && (
                              <>
                                <a href={mapUrl} target="_blank" rel="noreferrer" className={BUTTON}>
                                  Check the pin
                                </a>
                                <button type="button" onClick={() => setMapUrl("")} className="text-muted hover:text-ink">
                                  Remove pin
                                </button>
                              </>
                            )}
                            {!mapUrl && address.length >= LIMITS.address[0] && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Abu Dhabi`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className={BUTTON}
                              >
                                Find my address on Google Maps
                              </a>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="grid gap-2">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={LABEL}>Date and time</span>
                  <span className="text-xs text-muted">
                    {moving ? `Click a new start time (${hours(moving.minutes)})` : "Click a start time, or drag down for 2–4 hours"}
                  </span>
                </p>
                {days.status === "loading" && <p className="text-sm text-muted">Loading free times…</p>}
                {days.status === "error" && (
                  <p role="alert" className="text-sm text-gold">
                    {days.message}
                  </p>
                )}
                {days.status === "ready" && days.days.length === 0 && (
                  <p className="text-sm text-muted">No free times in the next {DAYS} days. Message us on WhatsApp and we&rsquo;ll find one.</p>
                )}
                {days.status === "ready" && days.days.length > 0 && (
                  <SlotGrid days={days.days} calendar={calendar} lengths={lengths} fixedMinutes={moving?.minutes} value={selection} onChange={setSelection} />
                )}
              </div>

              {!moving && (
                <label className="grid gap-2">
                  <span className={LABEL}>Notes (optional)</span>
                  <textarea
                    rows={3}
                    maxLength={LIMITS.notes}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Readings, questions or a mock you want to go through"
                    className={`${FIELD} resize-y`}
                  />
                </label>
              )}
            </fieldset>

            {noticeEl}
            <button
              type="submit"
              disabled={readOnly || busy || !selection || !course || (mode === "in_person" && mapLinkInvalid)}
              className="inline-flex h-12 items-center justify-center rounded-md bg-gold px-6 text-[15px] font-semibold text-canvas transition-colors hover:bg-gold-bright disabled:opacity-50"
            >
              {busy ? "Saving…" : moving ? "Move session" : selection ? `Book ${hours(selection.minutes)} session` : "Book session"}
            </button>
          </form>
        </div>
      )}
    </div>
    </PortalTabs>
  );
}
