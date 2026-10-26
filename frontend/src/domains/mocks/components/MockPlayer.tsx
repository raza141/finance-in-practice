"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { autosaveMock, pauseMock, resumeMock, submitMock } from "../actions/mocks";
import { MockGrader } from "../services/MockGrader";
import type { MockResponse, OptionLetter } from "../types";

/** A question with its text already rendered on the server (KaTeX included). No answer, no explanation. */
export interface PlayerQuestion {
  id: string;
  number: number;
  vignette: ReactNode | null;
  question: ReactNode;
  options: [ReactNode, ReactNode, ReactNode];
}

type Answer = Omit<MockResponse, "questionId">;
const LETTERS: OptionLetter[] = ["A", "B", "C"];
const BLANK: Answer = { selected: null, flagged: false, notes: "" };
const AUTOSAVE_MS = 20_000;

/** The side-panel icon (as in a chat app's sidebar toggle): a window with its left column marked. */
function PanelIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5">
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2" />
      <path d="M7.75 3.75v12.5" />
    </svg>
  );
}

const ICON_BUTTON = "grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink";

/**
 * The CBT player. Navigation, answers, flags, notes and strike-throughs live in the
 * browser (no server call per click). Every change is kept in localStorage at once and
 * autosaved every 20 seconds and whenever the tab is hidden. The clock is the server's
 * end time, so a refresh resumes it; at zero the attempt submits itself. Paused, the student
 * stays on this screen with the clock stopped (notes and answers stay open) until Resume.
 */
export function MockPlayer({
  attemptId,
  studentName,
  title,
  tag,
  remainingMs,
  questions,
  initial,
  session = null,
  paused: pausedAtStart = false,
  answerKey,
  exitHref = "/student",
}: {
  attemptId: string;
  studentName: string;
  title: string;
  tag: string;
  /** Computed on the server at render, so a wrong clock on the student's device doesn't matter. */
  remainingMs: number;
  questions: PlayerQuestion[];
  initial: MockResponse[];
  /** A full mock's session ("Session 1 of 2"): its own questions, numbered from 1; null for one sitting. */
  session?: { index: number; of: number } | null;
  /** Opened while paused (e.g. after a refresh): the clock waits for Resume. */
  paused?: boolean;
  /** The admin's try-out: nothing is sent to the server, and Submit marks the answers against this key. */
  answerKey?: Record<string, OptionLetter>;
  /** Where the try-out's Exit goes. */
  exitHref?: string;
}) {
  const preview = answerKey !== undefined;
  const [checked, setChecked] = useState(false);
  const last = !session || session.index === session.of;
  const router = useRouter();
  const storageKey = `fip-mock:${attemptId}${session ? `:${session.index}` : ""}`;
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => Object.fromEntries(initial.map(({ questionId, ...a }) => [questionId, a])));
  const [current, setCurrent] = useState(0);
  const [struck, setStruck] = useState<Record<string, OptionLetter[]>>({});
  const [deadline, setDeadline] = useState(() => Date.now() + remainingMs);
  const [paused, setPaused] = useState(pausedAtStart);
  // The server takes no answers while paused: changes stay in localStorage and are saved on resume.
  const pausedRef = useRef(pausedAtStart);
  const [left, setLeft] = useState(Math.max(0, Math.ceil(remainingMs / 1000)));
  const [confirming, setConfirming] = useState(false);
  // The numbered palette: open beside the question on wide screens, closed on phones (it would push the question down).
  const [palette, setPalette] = useState(true);
  const [state, setState] = useState<"working" | "submitting" | "pausing" | "resuming" | "error">("working");
  const dirty = useRef(false);
  const submitted = useRef(false);

  // This device's unsaved changes (e.g. notes typed just before a refresh) win over the last autosave.
  useEffect(() => {
    if (preview) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Record<string, Answer> | null;
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring this browser's copy after hydration
        setAnswers((a) => ({ ...a, ...saved }));
        dirty.current = true;
      }
    } catch {}
  }, [preview, storageKey]);

  const wide = () => window.matchMedia("(min-width: 1024px)").matches;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the screen width is only known in the browser
    if (!wide()) setPalette(false);
  }, []);

  const list = useCallback(
    (a: Record<string, Answer>): MockResponse[] => questions.map((q) => ({ questionId: q.id, ...(a[q.id] ?? BLANK) })),
    [questions],
  );

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submit = useCallback(async () => {
    if (preview) {
      setConfirming(false);
      return setChecked(true);
    }
    if (submitted.current) return;
    submitted.current = true;
    setState("submitting");
    try {
      const { ok } = await submitMock(attemptId, list(answersRef.current));
      if (!ok) throw new Error("submit refused");
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      router.refresh();
    } catch {
      submitted.current = false;
      setState("error");
    }
  }, [attemptId, list, preview, router, storageKey]);

  const save = useCallback(async () => {
    if (!dirty.current || submitted.current || pausedRef.current || preview) return;
    dirty.current = false;
    try {
      const { open } = await autosaveMock(attemptId, list(answersRef.current));
      if (!open) void submit();
    } catch {
      dirty.current = true;
    }
  }, [attemptId, list, preview, submit]);

  // Saves and stops the server's clock; the student stays here and the clock waits for Resume.
  const pause = async () => {
    if (submitted.current || pausedRef.current) return;
    if (preview) {
      pausedRef.current = true;
      return setPaused(true);
    }
    setState("pausing");
    const res = await pauseMock(attemptId, list(answersRef.current)).catch(() => null);
    if (res?.ok) {
      pausedRef.current = true;
      dirty.current = false;
      setPaused(true);
    }
    setState("working");
  };

  // Restarts the server's clock and carries on from its new end time; changes made while paused are saved now.
  const resume = async () => {
    if (preview) {
      pausedRef.current = false;
      setDeadline(Date.now() + left * 1000);
      return setPaused(false);
    }
    setState("resuming");
    const res = await resumeMock(attemptId).catch(() => null);
    if (!res) return setState("working");
    if (res.remainingMs === null) return router.refresh();
    pausedRef.current = false;
    setDeadline(Date.now() + res.remainingMs);
    setPaused(false);
    setState("working");
    dirty.current = true;
    void save();
  };

  // The clock, from the server's end time. Stopped while paused.
  useEffect(() => {
    if (paused || checked) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) void submit();
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [checked, deadline, paused, submit]);

  useEffect(() => {
    const timer = window.setInterval(() => void save(), AUTOSAVE_MS);
    const hidden = () => document.visibilityState === "hidden" && void save();
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [save]);

  const change = (id: string, patch: Partial<Answer>) => {
    setAnswers((a) => {
      const next = { ...a, [id]: { ...(a[id] ?? BLANK), ...patch } };
      try {
        if (!preview) localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    dirty.current = true;
  };

  const q = questions[current];
  const mine = answers[q.id] ?? BLANK;
  const answered = questions.filter((x) => answers[x.id]?.selected).length;
  const unanswered = questions.length - answered;
  const toggleStrike = (letter: OptionLetter) =>
    setStruck((s) => {
      const now = s[q.id] ?? [];
      return { ...s, [q.id]: now.includes(letter) ? now.filter((l) => l !== letter) : [...now, letter] };
    });

  const tile = (i: number) => {
    const a = answers[questions[i].id];
    // Marked try-out: right in green, wrong in red.
    const mark = checked && a?.selected ? (a.selected === answerKey![questions[i].id] ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-200" : "border-red-400/70 bg-red-400/20 text-red-200") : null;
    const tone = mark ?? (a?.flagged ? "border-gold bg-gold/25 text-gold" : a?.selected ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-200" : "border-line bg-surface text-muted");
    return `${tone} ${i === current ? "ring-2 ring-quant ring-offset-2 ring-offset-canvas" : ""}`;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-md">
        {preview && (
          <p className="flex items-center justify-between gap-3 bg-gold/90 px-4 py-1 font-mono text-[11px] tracking-wider text-canvas uppercase sm:px-6">
            <span>Try-out · nothing is saved, students don&rsquo;t see this</span>
            <a href={exitHref} className="underline">
              Exit
            </a>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          {/* Phones: no room for the name; the bar keeps the title, the toggle and the clock on two lines. */}
          <p className="hidden min-w-0 text-sm sm:block">
            <span className="text-muted">Candidate: </span>
            <span className="font-semibold">{studentName}</span>
          </p>
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold">{title}</span>
            <span className="ml-2 rounded border border-quant/40 px-1.5 py-0.5 font-mono text-[11px] text-quant">{tag}</span>
            {session && (
              <span className="ml-2 rounded border border-gold/50 px-1.5 py-0.5 font-mono text-[11px] text-gold">
                Session {session.index} of {session.of}
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <div className="hidden w-40 sm:block" aria-hidden>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-emerald-400 transition-[width]" style={{ width: `${(answered / questions.length) * 100}%` }} />
              </div>
            </div>
            <span className="font-mono text-xs text-muted">
              Answered {answered} of {questions.length}
            </span>
          </div>
          <p
            role="timer"
            aria-label="Time left"
            className={`rounded-md border px-3 py-1 font-mono text-lg tabular-nums ${left <= 300 ? "border-red-400/60 text-red-300" : "border-line text-ink"}`}
          >
            ⏱ {MockGrader.clock(left)}
          </p>
          {paused && (
            <a href={exitHref} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink">
              ← {preview ? "Exit" : "Back to portal"}
            </a>
          )}
          {paused ? (
            <button
              type="button"
              onClick={() => void resume()}
              disabled={state === "resuming"}
              className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-canvas hover:bg-gold-bright disabled:opacity-60"
            >
              {state === "resuming" ? "Resuming…" : "▶ Resume"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void pause()}
              disabled={state === "pausing" || state === "submitting"}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink disabled:opacity-60"
            >
              {state === "pausing" ? "Pausing…" : "⏸ Pause"}
            </button>
          )}
        </div>
        {paused && (
          <p role="status" className="border-t border-gold/40 bg-gold/10 px-4 py-2 text-sm text-gold sm:px-6">
            Paused: the clock has stopped. You can keep writing notes; press Resume to carry on.{preview ? "" : " Your work is kept: you can go back to the portal and resume from there."}
          </p>
        )}
      </header>

      <div className={`grid flex-1 gap-4 p-4 sm:p-6 ${palette ? "lg:grid-cols-[13rem_1fr]" : ""}`}>
        {palette && (
          <nav id="mock-palette" aria-label="Questions" className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-11rem)] lg:self-start lg:overflow-y-auto">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Questions</span>
              <button type="button" aria-expanded aria-controls="mock-palette" aria-label="Hide question numbers" title="Hide question numbers" onClick={() => setPalette(false)} className={ICON_BUTTON}>
                <PanelIcon />
              </button>
            </div>
            <ol className="grid grid-cols-8 gap-1.5 sm:grid-cols-12 lg:grid-cols-5">
              {questions.map((x, i) => (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrent(i);
                      // Phones: back to the question once one is picked.
                      if (!wide()) setPalette(false);
                    }}
                    aria-current={i === current ? "true" : undefined}
                    aria-label={`Question ${x.number}${answers[x.id]?.selected ? ", answered" : ""}${answers[x.id]?.flagged ? ", flagged" : ""}`}
                    className={`h-9 w-full rounded-md border font-mono text-xs transition-colors ${tile(i)}`}
                  >
                    {x.number}
                  </button>
                </li>
              ))}
            </ol>
            <ul className="mt-4 grid gap-1.5 text-xs text-muted">
              <li className="flex items-center gap-2">
                <span className="size-3 rounded-sm border border-emerald-400/70 bg-emerald-400/20" /> Answered
              </li>
              <li className="flex items-center gap-2">
                <span className="size-3 rounded-sm border border-gold bg-gold/25" /> Flagged for review
              </li>
              <li className="flex items-center gap-2">
                <span className="size-3 rounded-sm border border-line bg-surface" /> Unanswered
              </li>
            </ul>
          </nav>
        )}

        <main className="grid min-w-0 content-start gap-4">
          <div className={`grid gap-4 ${q.vignette ? "xl:grid-cols-2" : ""}`}>
            {q.vignette && (
              <section aria-label="Case" className="max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-surface/60 p-5">
                <h2 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Vignette</h2>
                <div className="mt-3 text-ink/90">{q.vignette}</div>
              </section>
            )}
            <section aria-label={`Question ${q.number}`} className="rounded-xl border border-line bg-surface/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {!palette && (
                    <button type="button" aria-expanded={false} aria-label="Show question numbers" title="Show question numbers" onClick={() => setPalette(true)} className={`${ICON_BUTTON} -ml-1.5`}>
                      <PanelIcon />
                    </button>
                  )}
                  <h2 className="font-mono text-xs tracking-[0.16em] text-quant uppercase">
                    Question {q.number} of {questions.length}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-pressed={mine.flagged}
                  onClick={() => change(q.id, { flagged: !mine.flagged })}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${mine.flagged ? "border-gold bg-gold/20 text-gold" : "border-line text-muted hover:text-ink"}`}
                >
                  {mine.flagged ? "⚑ Flagged" : "⚐ Flag for review"}
                </button>
              </div>
              <div className="mt-4 text-[1.05rem] leading-relaxed">{q.question}</div>
              <fieldset className="mt-5">
                <legend className="sr-only">Choose one answer</legend>
                <ul className="grid gap-2.5">
                  {LETTERS.map((letter, i) => {
                    const on = mine.selected === letter;
                    const right = checked && answerKey![q.id] === letter;
                    const off = struck[q.id]?.includes(letter);
                    return (
                      <li key={letter} className="flex items-stretch gap-2">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => change(q.id, { selected: on ? null : letter })}
                          className={`flex min-h-14 flex-1 items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-colors ${right ? "border-emerald-400 bg-emerald-400/10" : checked && on ? "border-red-400 bg-red-400/10" : on ? "border-quant bg-quant/10" : "border-line bg-surface hover:border-quant/50"} ${off ? "opacity-45" : ""}`}
                        >
                          <span className={`grid size-8 shrink-0 place-items-center rounded-md border font-mono text-sm ${on ? "border-quant bg-quant text-canvas" : "border-line text-muted"}`}>
                            {letter}
                          </span>
                          <span className={`min-w-0 flex-1 ${off ? "line-through decoration-2" : ""}`}>{q.options[i]}</span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={off}
                          aria-label={`Strike out ${letter}`}
                          title="Strike out this option"
                          onClick={() => toggleStrike(letter)}
                          className={`w-12 shrink-0 rounded-xl border text-sm transition-colors ${off ? "border-red-400/60 text-red-300" : "border-line text-muted hover:text-ink"}`}
                        >
                          <span aria-hidden className="line-through">
                            abc
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </section>
          </div>

          <section aria-label="Notes" className="rounded-xl border border-line bg-surface/60 p-5">
            <label htmlFor="mock-notes" className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
              Scratchpad · your notes for this question, kept for revision
            </label>
            <textarea
              id="mock-notes"
              value={mine.notes}
              maxLength={5000}
              onChange={(e) => change(q.id, { notes: e.target.value })}
              rows={4}
              placeholder="Type your formula or revision notes here…"
              className="mt-2 w-full rounded-md border border-line bg-canvas/80 px-3 py-2.5 font-mono text-sm text-ink outline-none placeholder:text-muted/50 focus:border-quant/70"
            />
          </section>
        </main>
      </div>

      <footer className="sticky bottom-0 z-30 border-t border-line bg-canvas/95 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setCurrent((c) => c - 1)}
            className="h-10 rounded-md border border-line px-4 text-sm disabled:opacity-40"
          >
            ‹ Previous
          </button>
          {/* Phones: the bar above already shows it, and the buttons keep to one row. */}
          <p className="hidden font-mono text-xs text-muted sm:block">
            Progress: {answered}/{questions.length} ({MockGrader.percent(answered, questions.length)}%)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={current === questions.length - 1}
              onClick={() => setCurrent((c) => c + 1)}
              className="h-10 rounded-md border border-line px-4 text-sm disabled:opacity-40"
            >
              Next ›
            </button>
            {checked ? (
              <span className="font-mono text-sm">
                Score {questions.filter((x) => answers[x.id]?.selected === answerKey![x.id]).length}/{questions.length}
                <a href={exitHref} className="ml-3 rounded-md bg-gold px-4 py-2 font-sans font-semibold text-canvas">
                  Done
                </a>
              </span>
            ) : (
            <button type="button" onClick={() => setConfirming(true)} disabled={state === "submitting" || paused} title={paused ? "Resume to submit" : undefined} className="h-10 rounded-md bg-gold px-5 text-sm font-semibold text-canvas hover:bg-gold-bright disabled:opacity-60">
              {state === "submitting" ? "Submitting…" : last ? "Submit" : `End session ${session!.index}`}
            </button>
            )}
          </div>
        </div>
        {(confirming || state === "error") && state !== "submitting" && !paused && (
          <div role="alertdialog" aria-label="Submit the mock" className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-4 py-3 text-sm sm:px-6">
            <p className={state === "error" ? "text-red-300" : "text-ink"}>
              {state === "error"
                ? "Submitting didn't work. Your answers are kept on this device; please try again."
                : unanswered
                  ? `${unanswered} question${unanswered > 1 ? "s are" : " is"} unanswered. ${last ? "Submit anyway?" : "End the session anyway?"}`
                  : last
                    ? "Submit your answers? You can't change them afterwards."
                    : `End session ${session!.index}? Its answers lock, and session ${session!.index + 1} follows after an optional break.`}
            </p>
            <button type="button" onClick={() => setConfirming(false)} className="h-9 rounded-md border border-line px-4">
              Keep working
            </button>
            <button type="button" onClick={() => void submit()} className="h-9 rounded-md bg-gold px-4 font-semibold text-canvas">
              {last ? "Submit now" : "End session now"}
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
