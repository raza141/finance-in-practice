"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { ApiError } from "@/core/http/ApiError";

import { TerminalAnimator } from "../animations/TerminalAnimator";
import { CalAvailabilityProvider, type AvailabilityProvider } from "../services/AvailabilityProvider";
import { BookingApiClient } from "../services/BookingApiClient";
import { BookingCatalog } from "../services/BookingCatalog";
import { BookingContract, type CreateBookingResponse } from "../services/BookingContract";
import { TerminalFormat } from "../services/TerminalFormat";
import { ZonedCalendar } from "../services/ZonedCalendar";
import type { DayLiquidity, TimeSlot, TrackId } from "../types";
import { LiquidityCurve } from "./LiquidityCurve";
import { OrderBook } from "./OrderBook";
import { TrackTabs } from "./TrackTabs";

const PROJECTION_DAYS = 14;
const STAGES = ["COURSE", "DATE", "TIME", "CONFIRM"] as const;

type Load<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

/** submitting = POST in flight; running = confirmed, animation playing. */
type Execution = "idle" | "submitting" | "running" | "done";

const isAbort = (error: unknown) =>
  (error instanceof DOMException && error.name === "AbortError") ||
  (error instanceof ApiError && error.kind === "aborted");

const messageOf = (error: unknown) =>
  error instanceof ApiError ? error.message : "Something went wrong. Please retry.";

interface QuantBookingWidgetProps {
  provider?: AvailabilityProvider;
  bookingClient?: BookingApiClient;
}

/**
 * Booking as a trading terminal:
 *   1. asset-class tabs (track) -> 2. liquidity curve (date)
 *   -> 3. L2 order book (time) -> 4. trade execution (live Cal.com booking).
 */
export function QuantBookingWidget({ provider, bookingClient }: QuantBookingWidgetProps) {
  // Instances are created once and never mutated during render.
  const [feedProvider] = useState<AvailabilityProvider>(() => provider ?? new CalAvailabilityProvider());
  const [api] = useState(() => bookingClient ?? new BookingApiClient());
  const [catalog] = useState(() => new BookingCatalog());
  const [animator] = useState(() => new TerminalAnimator());

  const [track, setTrack] = useState<TrackId | null>(null);
  const [projection, setProjection] = useState<Load<DayLiquidity[]>>({ status: "idle" });
  const [date, setDate] = useState<string | null>(null);
  const [book, setBook] = useState<Load<DayLiquidity>>({ status: "idle" });
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [orderError, setOrderError] = useState<string | null>(null);
  const [execution, setExecution] = useState<Execution>("idle");
  const [booking, setBooking] = useState<CreateBookingResponse | null>(null);
  const [timeZone, setTimeZone] = useState("UTC");

  const projectionRequest = useRef<AbortController | null>(null);
  const bookRequest = useRef<AbortController | null>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLParagraphElement>(null);

  const days = projection.status === "ready" ? projection.data : null;
  const day = book.status === "ready" ? book.data : null;
  const busy = execution === "submitting" || execution === "running";
  const stage = !track ? 0 : !date ? 1 : execution === "idle" || execution === "submitting" ? 2 : 3;
  const finalText = feedProvider.isSimulated
    ? "[ DIVIDEND CAPTURED: SESSION STAGED ]"
    : "[ DIVIDEND CAPTURED: SESSION SCHEDULED ]";

  // --- data --------------------------------------------------------------

  const loadProjection = (id: TrackId, zone: string) => {
    projectionRequest.current?.abort();
    const controller = new AbortController();
    projectionRequest.current = controller;
    setProjection({ status: "loading" });
    feedProvider
      .getProjection({ track: id, days: PROJECTION_DAYS, timeZone: zone }, controller.signal)
      .then((data) => setProjection({ status: "ready", data }))
      .catch((error: unknown) => {
        if (!isAbort(error)) setProjection({ status: "error", message: messageOf(error) });
      });
  };

  /** Always fetch the clicked day fresh: the projection may be minutes old. */
  const loadBook = (forDate: string, zone: string) => {
    bookRequest.current?.abort();
    const controller = new AbortController();
    bookRequest.current = controller;
    setBook({ status: "loading" });
    feedProvider
      .getDay(forDate, zone, controller.signal)
      .then((data) => setBook({ status: "ready", data }))
      .catch((error: unknown) => {
        if (!isAbort(error)) setBook({ status: "error", message: messageOf(error) });
      });
  };

  useEffect(
    () => () => {
      projectionRequest.current?.abort();
      bookRequest.current?.abort();
    },
    [],
  );
  useEffect(() => () => animator.dispose(), [animator]);

  // --- interactions --------------------------------------------------------

  const lockTrack = (id: TrackId) => {
    if (busy || (id === track && projection.status !== "error")) return;
    const zone = ZonedCalendar.visitorTimeZone();
    setTimeZone(zone);
    setTrack(id);
    setDate(null);
    setBook({ status: "idle" });
    setSlot(null);
    setOrderError(null);
    setExecution("idle");
    loadProjection(id, zone);
  };

  const lockDate = (next: string) => {
    if (execution !== "idle") return;
    setDate(next);
    setSlot(null);
    setOrderError(null);
    loadBook(next, timeZone);
  };

  const execute = async (event: FormEvent) => {
    event.preventDefault();
    if (!track || !slot || execution !== "idle") return;
    if (name.trim().length < 2) return setOrderError("Enter your full name.");
    if (!BookingContract.isEmail(email)) return setOrderError("Enter a valid email address.");
    if (phone.trim() && !BookingContract.isPhone(phone)) return setOrderError("Enter a valid phone number, or leave it empty.");

    setOrderError(null);
    setExecution("submitting");
    try {
      const result = await api.create({
        start: slot.start,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        timeZone,
        track,
        company,
      });
      setBooking(result);
      setExecution("running"); // only now does the confirmation sequence play
    } catch (error) {
      setExecution("idle");
      setOrderError(messageOf(error));
      if (error instanceof ApiError && error.status === 409 && date) {
        setSlot(null);
        loadBook(date, timeZone); // refresh the book so the taken slot disappears
      }
    }
  };

  const reset = () => {
    setTrack(null);
    setProjection({ status: "idle" });
    setDate(null);
    setBook({ status: "idle" });
    setSlot(null);
    setOrderError(null);
    setBooking(null);
    setExecution("idle");
  };

  // --- animation hooks -----------------------------------------------------

  useEffect(() => {
    if (book.status === "ready" && execution === "idle" && bookRef.current) {
      animator.openOrderBook(bookRef.current);
    }
    // Opening is tied to a freshly loaded book only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animator, book.status, date]);

  useEffect(() => {
    if (execution !== "running" || !readoutRef.current) return;
    let cancelled = false;
    animator
      .execute({
        book: bookRef.current,
        flash: flashRef.current,
        readout: readoutRef.current,
        finalText,
      })
      .then(() => {
        if (!cancelled) setExecution("done");
      });
    return () => {
      cancelled = true;
    };
  }, [animator, execution, finalText]);

  // --- render --------------------------------------------------------------

  const zone = new ZonedCalendar(timeZone);
  const zoneLabel = zone.abbreviation(slot ? new Date(slot.start) : new Date());
  const ticket = track && date && slot ? { track: catalog.track(track), date, slot } : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-line font-mono text-ink shadow-[0_30px_80px_-30px_rgb(0_0_0/0.7)]">
      {/* Flash layer: the terminal background that strobes on execution. */}
      <div ref={flashRef} aria-hidden className="absolute inset-0 bg-surface" />

      <div className="relative">
        {/* title bar */}
        <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas/60 px-4 py-2.5 text-xs tracking-wider">
          <span className="text-muted">
            <span className="text-ink">FIP/BOOK</span> ▸ DIAGNOSTIC SESSION
          </span>
          <span className="flex items-center gap-2 text-quant">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-gold" />
            {feedProvider.isSimulated ? "SIMULATED FEED" : "LIVE FEED"}
          </span>
        </div>

        {/* stage rail */}
        <ol className="flex items-center gap-2 overflow-x-auto px-4 pt-3 text-xs tracking-widest whitespace-nowrap">
          {STAGES.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={i === stage ? "step" : undefined}
                className={i === stage ? "text-quant" : i < stage ? "text-ink/70" : "text-muted/60"}
              >
                {String(i + 1).padStart(2, "0")} {label}
              </span>
              {i < STAGES.length - 1 && <span className="text-muted/40">›</span>}
            </li>
          ))}
        </ol>

        <div className="px-4 pt-2 pb-5">
          {/* Stage 1 */}
          <TrackTabs
            tracks={catalog.tracks()}
            locked={track}
            disabled={busy}
            onLock={lockTrack}
          />

          {/* Stage 2 */}
          <div className="mt-4">
            {projection.status === "idle" && (
              <Placeholder>
                PICK A COURSE ABOVE TO SEE OPEN DAYS (NEXT {PROJECTION_DAYS} DAYS)
              </Placeholder>
            )}
            {projection.status === "loading" && (
              <Placeholder tone="quant">
                <span className="animate-pulse-soft">FETCHING LIVE LIQUIDITY CURVE…</span>
              </Placeholder>
            )}
            {projection.status === "error" && (
              <Placeholder>
                FEED ERROR · {projection.message.toUpperCase()} ·{" "}
                <button
                  type="button"
                  className="text-quant underline-offset-4 hover:underline"
                  onClick={() => track && loadProjection(track, timeZone)}
                >
                  RETRY
                </button>
              </Placeholder>
            )}
            {days && (
              <LiquidityCurve
                key={track}
                days={days}
                selectedDate={date}
                animator={animator}
                onSelect={lockDate}
              />
            )}
          </div>

          {/* Stage 3 */}
          {date && book.status === "loading" && (
            <p className="mt-5 text-center text-xs tracking-wider text-quant">
              <span className="animate-pulse-soft">FETCHING ORDER BOOK…</span>
            </p>
          )}
          {date && book.status === "error" && (
            <p className="mt-5 text-center text-xs tracking-wider text-muted">
              ORDER BOOK UNAVAILABLE · {book.message.toUpperCase()} ·{" "}
              <button
                type="button"
                className="text-quant hover:underline"
                onClick={() => loadBook(date, timeZone)}
              >
                RETRY
              </button>
            </p>
          )}

          {day && execution !== "done" && (
            <div ref={bookRef} className="overflow-hidden">
              {day.slots.length === 0 ? (
                <p className="mt-5 rounded-lg border border-line px-4 py-6 text-center text-xs tracking-wider text-muted">
                  NO LIQUIDITY LEFT ON {TerminalFormat.date(day.date)} · PICK ANOTHER DATE
                </p>
              ) : (
                <OrderBook
                  day={day}
                  selected={slot}
                  zoneLabel={zoneLabel}
                  onSelect={(s) => {
                    setSlot(s);
                    setOrderError(null);
                  }}
                />
              )}
              <p className="mt-2 text-xs tracking-wider text-muted">
                Converted to your local time: <span className="text-ink/80">{timeZone}</span>
              </p>

              {/* Attendee + execution */}
              <form onSubmit={execute} noValidate className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TerminalInput
                    label="NAME"
                    value={name}
                    onChange={setName}
                    autoComplete="name"
                    disabled={busy}
                  />
                  <TerminalInput
                    label="EMAIL"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                    disabled={busy}
                  />
                  <TerminalInput
                    label="PHONE"
                    type="tel"
                    value={phone}
                    onChange={setPhone}
                    autoComplete="tel"
                    disabled={busy}
                    optional
                    className="sm:col-span-2"
                  />
                </div>
                {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
                <input
                  type="text"
                  name="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                  className="absolute -left-[9999px] h-px w-px opacity-0"
                />

                {orderError && (
                  <p role="alert" className="text-xs tracking-wider text-gold">
                    ORDER REJECTED · {orderError}
                  </p>
                )}

                <div className="tabular-data flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs tracking-wider text-muted">
                    {ticket ? (
                      <>
                        ORDER <span className="text-ink">{ticket.track.ticker}</span> ·{" "}
                        {TerminalFormat.date(ticket.date)} · {ticket.slot.label} {zoneLabel} ·{" "}
                        {ticket.slot.durationMinutes}m
                      </>
                    ) : (
                      "PICK A TIME ABOVE"
                    )}
                  </p>
                  <button
                    type="submit"
                    disabled={!slot || execution !== "idle"}
                    className="h-11 rounded-md bg-gold px-5 text-sm font-bold tracking-widest text-canvas transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
                  >
                    {execution === "submitting" ? "ROUTING ORDER…" : "CONFIRM FREE SESSION"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Stage 4 */}
          {(execution === "running" || execution === "done") && (
            <div className="mt-5">
              <p
                ref={readoutRef}
                aria-hidden
                className="tabular-data min-h-[1.5em] text-center text-sm font-semibold tracking-wider text-gold sm:text-base"
              />
              {execution === "done" && ticket && (
                <div role="status" className="mt-5 rounded-lg border border-line bg-canvas/70 p-4 text-sm">
                  <span className="sr-only">{finalText}</span>
                  <dl className="tabular-data grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                    {[
                      ["TRACK", ticket.track.ticker],
                      ["DATE", `${TerminalFormat.weekday(ticket.date)} ${TerminalFormat.date(ticket.date)}`],
                      ["TIME", `${ticket.slot.label} ${zoneLabel}`],
                      ["REF", booking?.uid.slice(0, 8).toUpperCase() ?? "—"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs tracking-widest text-muted">{label}</dt>
                        <dd className="mt-0.5 text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 border-t border-line pt-4 font-sans text-sm leading-relaxed text-muted">
                    Confirmed. A calendar invite with the meeting link is on its way to{" "}
                    <span className="text-ink">{email.trim()}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-4 text-xs tracking-widest text-muted hover:text-quant"
                  >
                    ↺ NEW ORDER
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Placeholder({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "quant" }) {
  return (
    <div
      className={`grid aspect-[720/330] place-items-center rounded-lg border border-dashed border-line px-4 text-center text-xs tracking-wider ${
        tone === "quant" ? "text-quant" : "text-muted"
      }`}
    >
      <span>{children}</span>
    </div>
  );
}

interface TerminalInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  autoComplete: string;
  disabled?: boolean;
  /** Shows an "optional" placeholder and drops `required`. */
  optional?: boolean;
  className?: string;
}

function TerminalInput({ label, value, onChange, type = "text", autoComplete, disabled, optional = false, className = "" }: TerminalInputProps) {
  return (
    <label className={`flex items-center gap-3 rounded-md border border-line bg-canvas/70 px-3 focus-within:border-quant/70 ${className}`}>
      <span className="text-xs tracking-widest text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        required={!optional}
        placeholder={optional ? "optional" : undefined}
        maxLength={type === "email" ? 254 : 100}
        className="h-10 min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none placeholder:text-muted/50 disabled:opacity-60"
      />
    </label>
  );
}
