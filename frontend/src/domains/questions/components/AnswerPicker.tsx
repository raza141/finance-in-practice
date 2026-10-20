"use client";

import { animate, stagger } from "animejs";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { AnswerStore } from "../services/AnswerStore";

const CONFETTI = ["#d4af37", "#22d3ee", "#34d399", "#e6c65a", "#22d3ee", "#34d399", "#d4af37", "#f8fafc"];

/**
 * The interactive part of a question page. Options and the solution arrive already
 * rendered (KaTeX runs on the server), so this tracks the pick (one answer, then
 * locked, remembered per browser), times it against exam pace, offers the formula
 * as a hint and reveals the solution.
 */
export function AnswerPicker({
  storageKey,
  correct,
  options,
  solution,
  hint,
  paceSeconds,
  next,
}: {
  storageKey: string;
  correct: number;
  options: { letter: string; content: ReactNode }[];
  solution: ReactNode;
  /** The formula, offered before answering for readers who want a nudge. */
  hint?: ReactNode;
  /** Seconds per question at real exam pace; null shows the clock without a target. */
  paceSeconds: number | null;
  /** Shown beside the solution button once answered, so the reader can keep going. */
  next?: ReactNode;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [fresh, setFresh] = useState(false);
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [restored, setRestored] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = AnswerStore.picked(storageKey);
      if (saved !== null && saved >= 0 && saved < options.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the reader's earlier answer after hydration
        setPicked(saved);
        setRestored(true);
      }
    } catch {}
  }, [storageKey, options.length]);

  // The clock runs from page load until the pick.
  useEffect(() => {
    if (picked !== null) return;
    const started = Date.now() - seconds * 1000;
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when answered state changes
  }, [picked]);

  // Opening the solution lets its sections arrive one after another.
  useEffect(() => {
    const panel = panelRef.current?.firstElementChild;
    if (!open || !panel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = animate(Array.from(panel.children), { opacity: [0, 1], y: [10, 0], duration: 420, delay: stagger(70), ease: "outQuad" });
    return () => void animation.revert();
  }, [open]);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    setFresh(true);
    try {
      AnswerStore.save(storageKey, i, correct);
    } catch {}
  };

  const answered = picked !== null;
  const right = picked === correct;
  const over = paceSeconds !== null && seconds > paceSeconds;

  return (
    <div>
      <fieldset>
        <legend className="sr-only">{answered ? "Your answer" : "Select one answer"}</legend>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p aria-hidden className="text-sm text-muted">
            {answered ? "Your answer" : "Select one answer"}
          </p>
          {!restored && <Clock seconds={seconds} pace={paceSeconds} stopped={answered} />}
        </div>
        <ul className="grid gap-3">
          {options.map((o, i) => {
            const isCorrect = answered && i === correct;
            const isWrongPick = answered && i === picked && !right;
            const tone = isCorrect
              ? "border-emerald-400 bg-emerald-400/10"
              : isWrongPick
                ? "border-red-400 bg-red-400/10"
                : answered
                  ? "border-line bg-surface opacity-60"
                  : "border-line bg-surface hover:-translate-y-px hover:border-gold/70 hover:shadow-lg hover:shadow-black/30 focus-visible:border-gold";
            const celebrate = fresh && right && i === correct;
            return (
              <li key={o.letter} className="relative">
                <button
                  type="button"
                  onClick={() => pick(i)}
                  disabled={answered}
                  aria-pressed={picked === i}
                  className={`group flex min-h-16 w-full items-center gap-4 rounded-xl border-2 px-4 py-4 text-left text-[1.05rem] leading-relaxed text-ink sm:gap-5 sm:px-6 sm:text-lg transition-[transform,border-color,background-color,box-shadow] duration-200 disabled:cursor-default ${tone} ${celebrate ? "motion-safe:animate-[q-glow_1.2s_ease-out]" : ""} ${isCorrect && fresh && !right ? "motion-safe:animate-[q-pulse_1.4s_ease-out]" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`grid size-10 shrink-0 place-items-center rounded-lg border font-mono text-base font-semibold transition-colors ${isCorrect ? "border-emerald-400 text-emerald-300" : isWrongPick ? "border-red-400 text-red-300" : answered ? "border-line text-muted" : "border-line text-muted group-hover:border-gold group-hover:bg-gold group-hover:text-canvas group-focus-visible:border-gold group-focus-visible:text-gold"}`}
                  >
                    {isCorrect ? <Check draw={celebrate} /> : isWrongPick ? "✕" : o.letter}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="sr-only">{o.letter}. </span>
                    {o.content}
                  </span>
                  {isCorrect && <span className="shrink-0 text-xs font-semibold text-emerald-300">{i === picked ? "Correct" : "Correct answer"}</span>}
                  {isWrongPick && <span className="shrink-0 text-xs font-semibold text-red-300">Not quite</span>}
                </button>
                {celebrate && (
                  <span aria-hidden className="pointer-events-none absolute top-1/2 left-8 motion-reduce:hidden">
                    {CONFETTI.map((color, k) => (
                      <span
                        key={k}
                        className="absolute size-1.5 rounded-[1px] opacity-0 animate-[q-confetti_1.1s_ease-out]"
                        style={{
                          background: color,
                          ["--q-angle" as string]: `${k * 45 + 10}deg`,
                        }}
                      />
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      {!answered && hint && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowHint((v) => !v)}
            aria-expanded={showHint}
            className="text-sm text-quant underline-offset-4 hover:underline"
          >
            {showHint ? "Hide the formula" : "Stuck? Show the formula"}
          </button>
          {showHint && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-quant/30 bg-quant/5 px-4 py-3 text-lg motion-safe:animate-[q-fade_0.3s_ease-out]">
              {hint}
            </div>
          )}
        </div>
      )}

      <p aria-live="polite" className="mt-4 min-h-6 text-sm">
        {answered &&
          (right ? (
            <span className="text-emerald-300">Correct. {options[correct].letter} is the answer.</span>
          ) : (
            <span className="text-red-300">Not quite. The correct answer is {options[correct].letter}.</span>
          ))}
        {answered && !restored && (
          <span className="text-muted">
            {" "}
            You took {clock(seconds)}
            {paceSeconds !== null && (over ? `, ${clock(seconds - paceSeconds)} over exam pace.` : ", inside exam pace.")}
          </span>
        )}
      </p>

      {answered && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex h-12 items-center rounded-md bg-gold px-6 text-[15px] font-semibold text-canvas transition-colors hover:bg-gold-bright"
          >
            {open ? "Hide solution" : "Show full solution"}
          </button>
          {next}
        </div>
      )}
      <div id={panelId} ref={panelRef} hidden={!open}>
        {solution}
      </div>
    </div>
  );
}

function Check({ draw }: { draw: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.2 3L13 4.5" pathLength={1} className={draw ? "[stroke-dasharray:1] motion-safe:animate-[q-check_0.45s_ease-out_both]" : ""} />
    </svg>
  );
}

/** Elapsed time against exam pace: a ring that fills to the target and turns red past it. */
function Clock({ seconds, pace, stopped }: { seconds: number; pace: number | null; stopped: boolean }) {
  const over = pace !== null && seconds > pace;
  const share = pace ? Math.min(seconds / pace, 1) : 0;
  return (
    <p className={`flex items-center gap-2 font-mono text-sm tabular-nums ${over ? "text-red-300" : stopped ? "text-muted" : "text-ink/90"}`}>
      {pace !== null && (
        <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden>
          <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" className="stroke-line" />
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            strokeWidth="2.5"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - share}
            strokeLinecap="round"
            className={`transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none ${over ? "stroke-red-400" : "stroke-gold"}`}
          />
        </svg>
      )}
      <span>
        {clock(seconds)}
        {pace !== null && <span className="text-muted"> / {clock(pace)} exam pace</span>}
      </span>
    </p>
  );
}

function clock(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
