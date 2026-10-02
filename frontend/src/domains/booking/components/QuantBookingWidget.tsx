"use client";

import { useEffect, useRef, useState } from "react";

import { TerminalAnimator } from "../animations/TerminalAnimator";
import {
  MockAvailabilityProvider,
  TUTOR_TIMEZONE,
  type AvailabilityProvider,
} from "../services/AvailabilityProvider";
import { BookingCatalog } from "../services/BookingCatalog";
import { TerminalFormat } from "../services/TerminalFormat";
import type { DayLiquidity, TimeSlot, TrackId } from "../types";
import { LiquidityCurve } from "./LiquidityCurve";
import { OrderBook } from "./OrderBook";
import { TrackTabs } from "./TrackTabs";

const PROJECTION_DAYS = 14;
const STAGES = ["TRACK", "DATE", "TIME", "EXECUTE"] as const;

type Feed =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; days: DayLiquidity[] }
  | { status: "error" };

type Execution = "idle" | "running" | "done";

/**
 * Booking as a trading terminal:
 *   1. asset-class tabs (track) -> 2. liquidity curve (date)
 *   -> 3. L2 order book (time) -> 4. trade execution (confirmation).
 */
export function QuantBookingWidget({ provider }: { provider?: AvailabilityProvider }) {
  // Instances are created once and never mutated during render.
  const [feedProvider] = useState<AvailabilityProvider>(
    () => provider ?? new MockAvailabilityProvider(),
  );
  const [catalog] = useState(() => new BookingCatalog());
  const [animator] = useState(() => new TerminalAnimator());

  const [track, setTrack] = useState<TrackId | null>(null);
  const [feed, setFeed] = useState<Feed>({ status: "idle" });
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [execution, setExecution] = useState<Execution>("idle");

  const requestRef = useRef<AbortController | null>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLParagraphElement>(null);

  const days = feed.status === "ready" ? feed.days : null;
  const day = days?.find((d) => d.date === date) ?? null;
  const stage = !track ? 0 : !date ? 1 : execution === "idle" ? 2 : 3;
  const finalText = feedProvider.isSimulated
    ? "[ DIVIDEND CAPTURED: DEMO STAGED ]"
    : "[ DIVIDEND CAPTURED: DEMO SCHEDULED ]";

  // --- data --------------------------------------------------------------

  const loadProjection = (id: TrackId) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setFeed({ status: "loading" });
    feedProvider
      .getProjection({ track: id, days: PROJECTION_DAYS }, controller.signal)
      .then((result) => setFeed({ status: "ready", days: result }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setFeed({ status: "error" });
        }
      });
  };

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => () => animator.dispose(), [animator]);

  // --- interactions --------------------------------------------------------

  const lockTrack = (id: TrackId) => {
    if (execution === "running" || (id === track && feed.status !== "error")) return;
    setTrack(id);
    setDate(null);
    setSlot(null);
    setExecution("idle");
    loadProjection(id);
  };

  const lockDate = (next: string) => {
    if (execution !== "idle") return;
    setDate(next);
    setSlot(null);
  };

  const reset = () => {
    setTrack(null);
    setFeed({ status: "idle" });
    setDate(null);
    setSlot(null);
    setExecution("idle");
  };

  // --- animation hooks -----------------------------------------------------

  useEffect(() => {
    if (date && execution === "idle" && bookRef.current) animator.openOrderBook(bookRef.current);
    // Opening is tied to the date lock only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animator, date]);

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

  const ticket = track && day && slot ? { track: catalog.track(track), day, slot } : null;
  const confirmUrl = ticket ? catalog.confirmationUrl(ticket.day.date) : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-line font-mono text-ink shadow-[0_30px_80px_-30px_rgb(0_0_0/0.7)]">
      {/* Flash layer: the terminal background that strobes on execution. */}
      <div ref={flashRef} aria-hidden className="absolute inset-0 bg-surface" />

      <div className="relative">
        {/* title bar */}
        <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas/60 px-4 py-2.5 text-[11px] tracking-wider">
          <span className="text-muted">
            <span className="text-ink">FIP/BOOK</span> ▸ DEMO SESSION TERMINAL
          </span>
          <span className="flex items-center gap-2 text-quant">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-quant" />
            {feedProvider.isSimulated ? "SIMULATED FEED" : "LIVE FEED"}
          </span>
        </div>

        {/* stage rail */}
        <ol className="flex items-center gap-2 overflow-x-auto px-4 pt-3 text-[10px] tracking-widest whitespace-nowrap">
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
            disabled={execution === "running"}
            animator={animator}
            onLock={lockTrack}
          />

          {/* Stage 2 */}
          <div className="mt-4">
            {feed.status === "idle" && (
              <div className="grid aspect-[640/280] place-items-center rounded-lg border border-dashed border-line text-center text-[11px] tracking-wider text-muted">
                <span>
                  SELECT AN ASSET CLASS TO LOAD THE {PROJECTION_DAYS}-DAY LIQUIDITY CURVE
                </span>
              </div>
            )}
            {feed.status === "loading" && (
              <div className="grid aspect-[640/280] place-items-center rounded-lg border border-line/60 text-[11px] tracking-wider text-quant">
                <span className="animate-pulse-soft">FETCHING LIQUIDITY CURVE…</span>
              </div>
            )}
            {feed.status === "error" && (
              <div className="grid aspect-[640/280] place-items-center rounded-lg border border-line text-[11px] tracking-wider text-muted">
                <span>
                  FEED ERROR ·{" "}
                  <button
                    type="button"
                    className="text-quant underline-offset-4 hover:underline"
                    onClick={() => track && loadProjection(track)}
                  >
                    RETRY
                  </button>
                </span>
              </div>
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
          {day && execution !== "done" && (
            <div ref={bookRef} className="overflow-hidden">
              <OrderBook day={day} selected={slot} onSelect={setSlot} />
              <div className="tabular-data mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] tracking-wider text-muted">
                  {ticket ? (
                    <>
                      ORDER <span className="text-ink">{ticket.track.ticker}</span> ·{" "}
                      {TerminalFormat.date(ticket.day.date)} · {ticket.slot.label}{" "}
                      {TUTOR_TIMEZONE.label} · {ticket.slot.durationMinutes}m
                    </>
                  ) : (
                    "SELECT A TIME FROM THE BOOK"
                  )}
                </p>
                <button
                  type="button"
                  disabled={!slot || execution !== "idle"}
                  onClick={() => setExecution("running")}
                  className="h-11 rounded-md bg-gold px-5 text-xs font-bold tracking-widest text-canvas transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
                >
                  EXECUTE DEMO TRADE
                </button>
              </div>
            </div>
          )}

          {/* Stage 4 */}
          {execution !== "idle" && (
            <div className="mt-5">
              <p
                ref={readoutRef}
                aria-hidden
                className="tabular-data min-h-[1.5em] text-center text-sm font-semibold tracking-wider text-gold sm:text-base"
              />
              {execution === "done" && ticket && (
                <div role="status" className="mt-5 rounded-lg border border-line bg-canvas/70 p-4 text-xs">
                  <span className="sr-only">{finalText}</span>
                  <dl className="tabular-data grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                    {[
                      ["TRACK", ticket.track.ticker],
                      ["DATE", `${TerminalFormat.weekday(ticket.day.date)} ${TerminalFormat.date(ticket.day.date)}`],
                      ["TIME", `${ticket.slot.label} ${TUTOR_TIMEZONE.label}`],
                      ["SIZE", `${ticket.slot.durationMinutes} MIN`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[10px] tracking-widest text-muted">{label}</dt>
                        <dd className="mt-0.5 text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {feedProvider.isSimulated && (
                    <div className="mt-4 border-t border-line pt-4 font-sans text-sm leading-relaxed text-muted">
                      <p>
                        <span className="font-mono text-[11px] tracking-wider text-quant">
                          SIMULATED FEED ·{" "}
                        </span>
                        This slot is not reserved yet.{" "}
                        {confirmUrl
                          ? "Confirm it on Cal.com to receive your calendar invite."
                          : "Live scheduling opens shortly."}
                      </p>
                      {confirmUrl && (
                        <a
                          href={confirmUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex h-10 items-center rounded-md bg-gold px-4 font-mono text-xs font-bold tracking-widest text-canvas hover:bg-gold-bright"
                        >
                          CONFIRM ON CAL.COM →
                        </a>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={reset}
                    className="mt-4 text-[11px] tracking-widest text-muted hover:text-quant"
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
