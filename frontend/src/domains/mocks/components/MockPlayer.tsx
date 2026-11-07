"use client";

import { Flag, PanelLeft, Pause, Play, Timer } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { RAISED_GOLD, RAISED_PLAIN, RAISED_QUANT } from "@/core/components/ui/buttonStyles";
import { BackToPortal } from "@/domains/students/components/BackToPortal";
import { ThemeToggle } from "@/core/components/layout/PortalTheme";

import { MockGrader } from "../services/MockGrader";
import { playerCall } from "./playerCall";
import { SubmittedNotice } from "./SubmittedNotice";
import type { MockResponse, OptionLetter } from "../types";

/** A question with its text already rendered on the server (KaTeX included). No answer, no explanation. */
export interface PlayerQuestion {
  id: string;
  number: number;
  vignette: ReactNode | null;
  /** The first question of its vignette set: questions sharing it are one case (a Level II item set). */
  caseId?: string;
  question: ReactNode;
  options: [ReactNode, ReactNode, ReactNode];
}

type Answer = Omit<MockResponse, "questionId">;
const LETTERS: OptionLetter[] = ["A", "B", "C"];
const BLANK: Answer = { selected: null, flagged: false, notes: "", seconds: 0, confidence: null };
const AUTOSAVE_MS = 20_000;

/** What the student chose on a question (its time aside): to tell which changes on a screen never reached the server. */
const choice = (a: Partial<Answer> | undefined) => JSON.stringify([a?.selected ?? null, a?.flagged ?? false, a?.notes ?? "", a?.confidence ?? null]);

/** A random v4 UUID; crypto.randomUUID is missing in some older in-app browsers. */
function screenId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
// At zero the player submits; if that fails it tries again this often, not on every tick.
const AUTO_SUBMIT_RETRY_MS = 10_000;

/** The side-panel icon (as in a chat app's sidebar toggle): a window with its left column marked. */
function PanelIcon() {
  return (
    <PanelLeft aria-hidden strokeWidth={1.5} className="size-5" />
  );
}

const ICON_BUTTON = "grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink";

/**
 * The CBT player. Navigation, answers, flags, notes and strike-throughs live in the
 * browser (no server call per click). Every change is kept in localStorage at once and
 * autosaved every 20 seconds and whenever the tab is hidden. The clock is the server's
 * end time, so a refresh resumes it; at zero the attempt submits itself. Paused, the student
 * stays on this screen with the clock stopped and the questions hidden (no answering or moving on paused time) until Resume.
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
  exitHref = "/student?tab=mocks",
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
  // The last autosave failed: the student is told, and the answers wait in localStorage for the next one.
  const [unsaved, setUnsaved] = useState(false);
  // Pause or Resume didn't reach the server (asleep, offline, signed out): said, not swallowed, so the student presses again.
  const [callFailed, setCallFailed] = useState<"pause" | "resume" | null>(null);
  // The browser has no connection: the student is told at once, not only when the next autosave fails.
  const [offline, setOffline] = useState(false);
  const dirty = useRef(false);
  // Counts changes, so a save can tell whether the browser's copy still holds anything the server hasn't got.
  const edits = useRef(0);
  const submitted = useRef(false);
  // This tab's id. Opening the attempt claims it for this screen: any other open screen stops saving
  // (it would overwrite these answers with its own) and says so.
  const [screen] = useState(screenId);
  const claimed = useRef(false);
  // Taken over: null while this screen holds the attempt, else the questions changed here that the server never got.
  const [taken, setTaken] = useState<number[] | null>(null);
  // Each question's choice as the server last confirmed it from this screen.
  const confirmed = useRef<Record<string, string>>(Object.fromEntries(initial.map(({ questionId, ...a }) => [questionId, choice(a)])));
  const takenRef = useRef(false);
  const lastAutoSubmit = useRef(0);
  // The question on screen and since when: its time so far is added to every save, and to its answer on leaving.
  const onScreen = useRef<{ id: string; since: number } | null>(null);

  // This device's unsaved changes (e.g. notes typed just before a refresh) win over the last autosave.
  // Not when it opens paused: the pause saved everything and nothing changes while paused, so a copy
  // here is an older one from this device (another device may have answered since) and would blank those answers.
  useEffect(() => {
    if (preview) return;
    try {
      if (pausedAtStart) return localStorage.removeItem(storageKey);
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Record<string, Answer> | null;
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring this browser's copy after hydration
        setAnswers((a) => ({ ...a, ...saved }));
        dirty.current = true;
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only how the page opened counts
  }, [preview, storageKey]);

  const wide = () => window.matchMedia("(min-width: 1024px)").matches;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the screen width is only known in the browser
    if (!wide()) setPalette(false);
  }, []);

  const list = useCallback(
    (a: Record<string, Answer>): MockResponse[] =>
      questions.map((q) => {
        const base = { ...BLANK, ...a[q.id] };
        const live = onScreen.current?.id === q.id ? Math.round((Date.now() - onScreen.current.since) / 1000) : 0;
        return { questionId: q.id, ...base, seconds: Math.min(86_400, (base.seconds ?? 0) + live) };
      }),
    [questions],
  );

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Another screen took the attempt: this one stops writing, and drops its copy so it can't come back later.
  const lose = useCallback(() => {
    takenRef.current = true;
    setTaken(questions.filter((q) => choice(answersRef.current[q.id]) !== (confirmed.current[q.id] ?? choice(undefined))).map((q) => q.number));
    setState("working");
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [questions, storageKey]);

  const claim = useCallback(async () => {
    if (claimed.current || preview) return true;
    claimed.current = (await playerCall<{ ok: boolean }>(attemptId, { op: "claim", screen }).catch(() => null)) !== null;
    return claimed.current;
  }, [attemptId, preview, screen]);

  useEffect(() => {
    void claim();
  }, [claim]);

  const submit = useCallback(async (auto = false) => {
    if (preview) {
      setConfirming(false);
      return setChecked(true);
    }
    if (submitted.current || takenRef.current) return;
    submitted.current = true;
    setState("submitting");
    try {
      const { ok, stale, taken } = await playerCall<{ ok: boolean; stale?: boolean; taken?: boolean }>(attemptId, { op: "submit", screen, responses: list(answersRef.current), auto });
      if (!ok) throw new Error("submit refused");
      if (taken) {
        submitted.current = false;
        return lose();
      }
      // A full reload, not router.refresh(): it also picks up a deploy made during the exam.
      // Stale (paused or resumed elsewhere): the page reopens on the server's real clock, answers kept.
      if (!stale) {
        try {
          localStorage.removeItem(storageKey);
          // The results page confirms it (SubmittedNotice); a full mock only after its last session.
          if (last) sessionStorage.setItem(SubmittedNotice.key(attemptId), auto ? "auto" : "manual");
        } catch {}
      }
      window.location.reload();
    } catch {
      submitted.current = false;
      setState("error");
    }
  }, [attemptId, last, list, lose, preview, screen, storageKey]);

  const save = useCallback(async () => {
    if (!dirty.current || submitted.current || pausedRef.current || preview || takenRef.current) return;
    // Nothing is saved before this screen holds the attempt: it would overwrite a screen that has newer answers.
    if (!(await claim())) return setUnsaved(true);
    dirty.current = false;
    const sent = edits.current;
    const sentAnswers = answersRef.current;
    try {
      const { open, taken } = await playerCall<{ open: boolean; taken?: boolean }>(attemptId, { op: "save", screen, responses: list(sentAnswers) });
      if (taken) return lose();
      for (const q of questions) confirmed.current[q.id] = choice(sentAnswers[q.id]);
      setUnsaved(false);
      // All saved: drop the browser's copy, so it can't later override answers made on another device.
      if (edits.current === sent) {
        try {
          localStorage.removeItem(storageKey);
        } catch {}
      }
      if (!open) void submit(true);
    } catch {
      dirty.current = true;
      setUnsaved(true);
    }
  }, [attemptId, claim, list, lose, preview, questions, screen, storageKey, submit]);

  // Saves and stops the server's clock; the student stays here and the clock waits for Resume.
  const pause = async () => {
    if (submitted.current || pausedRef.current || takenRef.current) return;
    if (preview) {
      pausedRef.current = true;
      return setPaused(true);
    }
    setState("pausing");
    setCallFailed(null);
    const sentAnswers = answersRef.current;
    const res = await playerCall<{ ok: boolean; taken?: boolean }>(attemptId, { op: "pause", screen, responses: list(sentAnswers) }).catch(() => null);
    if (!res) setCallFailed("pause");
    if (res?.taken) return lose();
    if (res?.ok) {
      for (const q of questions) confirmed.current[q.id] = choice(sentAnswers[q.id]);
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
    setCallFailed(null);
    const res = await playerCall<{ remainingMs: number | null; taken?: boolean }>(attemptId, { op: "resume", screen }).catch(() => null);
    if (!res) return (setCallFailed("resume"), setState("working"));
    if (res.taken) return lose();
    if (res.remainingMs === null) return window.location.reload();
    pausedRef.current = false;
    setDeadline(Date.now() + res.remainingMs);
    setPaused(false);
    setState("working");
    dirty.current = true;
    void save();
  };

  // Offline: a banner; back online: save straight away instead of waiting for the next autosave.
  useEffect(() => {
    if (preview) return;
    const update = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) void save();
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [preview, save]);

  // The clock, from the server's end time. Stopped while paused.
  useEffect(() => {
    if (paused || checked) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && Date.now() - lastAutoSubmit.current >= AUTO_SUBMIT_RETRY_MS) {
        lastAutoSubmit.current = Date.now();
        void submit(true);
      }
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [checked, deadline, paused, submit]);

  useEffect(() => {
    const timer = window.setInterval(() => void save(), AUTOSAVE_MS);
    const hidden = () => document.visibilityState === "hidden" && void save();
    // Back on this screen: check at once that it still holds the attempt, before the student works on it.
    // Unsaved changes go with a normal save; otherwise an empty save (one light request), at most every 15 seconds.
    let lastCheck = 0;
    const back = () => {
      if (document.visibilityState !== "visible" || preview || submitted.current || pausedRef.current || takenRef.current) return;
      if (dirty.current) return void save();
      if (Date.now() - lastCheck < 15_000) return;
      lastCheck = Date.now();
      void playerCall<{ taken?: boolean }>(attemptId, { op: "save", screen, responses: [] })
        .then((r) => r.taken && lose())
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("focus", back);
    };
  }, [attemptId, lose, preview, save, screen]);

  const change = (id: string, patch: Partial<Answer> | ((before: Answer) => Partial<Answer>)) => {
    setAnswers((a) => {
      const before = { ...BLANK, ...a[id] };
      const next = { ...a, [id]: { ...before, ...(typeof patch === "function" ? patch(before) : patch) } };
      try {
        if (!preview && !takenRef.current) localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    edits.current += 1;
    dirty.current = true;
  };

  // Time on each question: counted while it's on screen and the clock runs, added to its answer when the student moves on or pauses.
  const currentId = questions[current].id;
  useEffect(() => {
    if (paused || checked || preview) return;
    const shown = { id: currentId, since: Date.now() };
    onScreen.current = shown;
    return () => {
      onScreen.current = null;
      const add = Math.round((Date.now() - shown.since) / 1000);
      if (add > 0) change(shown.id, (before) => ({ seconds: Math.min(86_400, (before.seconds ?? 0) + add) }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `change` only writes state; the clock restarts on these alone
  }, [currentId, paused, checked, preview]);

  const q = questions[current];
  // The item set this question belongs to.
  const set = q.caseId ? questions.filter((x) => x.caseId === q.caseId) : [];

  const caseRange = set.length > 1 ? `${set[0].number}–${set.at(-1)!.number}` : "";
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
    const tone = mark ?? (a?.flagged ? "border-gold bg-surface-raised text-gold" : a?.selected ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-200" : "border-line bg-surface text-muted");
    return `${tone} ${i === current ? "ring-2 ring-quant ring-offset-2 ring-offset-canvas" : ""}`;
  };

  return (
    <div className="flex min-h-screen flex-col">
      {taken !== null && (
        <div role="alertdialog" aria-modal aria-labelledby="mock-taken" className="fixed inset-0 z-50 grid place-items-center bg-canvas/95 p-6 backdrop-blur-sm">
          <div className="grid max-w-md gap-4 rounded-xl border border-gold/40 bg-surface p-6 text-center">
            <p id="mock-taken" className="font-serif text-2xl font-bold">
              Open on another screen
            </p>
            <p className="text-sm text-muted">
              This mock was opened in another tab or on another device. Only one screen can save at a time, so the two can&rsquo;t overwrite each other&rsquo;s answers.
            </p>
            {taken.length > 0 && (
              <p className="text-sm text-red-300">
                Your last change{taken.length > 1 ? "s" : ""} here to question{taken.length > 1 ? "s" : ""} {taken.join(", ")} {taken.length > 1 ? "were" : "was"} not saved. Check {taken.length > 1 ? "them" : "it"} on the other screen.
              </p>
            )}
            <div className="btn-group justify-center">
              <BackToPortal href={exitHref} label="Back to portal" />
              <button type="button" onClick={() => window.location.reload()} className={`h-10 px-4 text-sm font-semibold ${RAISED_GOLD}`}>
                Use this screen
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-md">
        {preview && (
          <p className="flex items-center justify-between gap-3 bg-gold px-4 py-1 font-mono text-[11px] tracking-wider text-canvas uppercase sm:px-6">
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
            <Timer aria-hidden className="mr-1 inline size-4 align-[-3px]" />
            {MockGrader.clock(left)}
          </p>
          <ThemeToggle />
          {paused && (
            <BackToPortal href={exitHref} label={preview ? "Exit" : "Back to portal"} />
          )}
          {paused ? (
            <button
              type="button"
              onClick={() => void resume()}
              disabled={state === "resuming"}
              className={`rounded-btn px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${RAISED_GOLD}`}
            >
              {state === "resuming" ? "Resuming…" : (
                <>
                  <Play aria-hidden fill="currentColor" className="mr-1 inline size-3.5 align-[-2px]" />
                  Resume
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void pause()}
              disabled={state === "pausing" || state === "submitting"}
              className={`rounded-btn px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${RAISED_PLAIN}`}
            >
              {state === "pausing" ? "Pausing…" : (
                <>
                  <Pause aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />
                  Pause
                </>
              )}
            </button>
          )}
        </div>
        {offline && (
          <p role="alert" className="border-t border-red-400/40 bg-red-400/10 px-4 py-2 text-sm text-red-300 sm:px-6">
            You&rsquo;re offline. Keep going: your answers are kept on this device and save as soon as you&rsquo;re back online. The clock keeps running.
          </p>
        )}
        {callFailed && (
          <p role="alert" className="border-t border-red-400/40 bg-red-400/10 px-4 py-2 text-sm text-red-300 sm:px-6">
            Couldn&rsquo;t {callFailed} just now. Check your connection and press {callFailed === "pause" ? "Pause" : "Resume"} again; if it still won&rsquo;t, refresh the page.{" "}
            {callFailed === "resume" ? "The clock stays stopped and your answers are saved." : "The clock is still running."}
          </p>
        )}
        {paused && (
          <p role="status" className="border-t border-gold/40 bg-surface-raised px-4 py-2 text-sm text-gold sm:px-6">
            Paused: the clock has stopped and the questions are hidden until you press Resume.{preview ? "" : " Your work is kept: you can go back to the portal and resume from there."}
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
                    disabled={paused}
                    onClick={() => {
                      setCurrent(i);
                      // Phones: back to the question once one is picked.
                      if (!wide()) setPalette(false);
                    }}
                    aria-current={i === current ? "true" : undefined}
                    aria-label={`Question ${x.number}${answers[x.id]?.selected ? ", answered" : ""}${answers[x.id]?.flagged ? ", flagged" : ""}`}
                    className={`h-9 w-full rounded-btn border font-mono text-xs transition-colors disabled:opacity-40 ${tile(i)}`}
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
                <span className="size-3 rounded-sm border border-gold bg-surface-raised" /> Flagged for review
              </li>
              <li className="flex items-center gap-2">
                <span className="size-3 rounded-sm border border-line bg-surface" /> Unanswered
              </li>
            </ul>
          </nav>
        )}

        <main className="grid min-w-0 content-start gap-4">
          {paused ? (
            <section aria-label="Paused" className="grid place-items-center gap-3 rounded-xl border border-gold/40 bg-surface-raised px-5 py-20 text-center">
              <p className="font-serif text-2xl font-bold">Mock paused</p>
              <p className="max-w-md text-sm text-muted">
                The clock is stopped at {MockGrader.clock(left)}. The questions stay hidden while you&rsquo;re on a break, so every minute you work on them is timed.
              </p>
              <button
                type="button"
                onClick={() => void resume()}
                disabled={state === "resuming"}
                className={`mt-2 h-11 rounded-btn px-6 text-sm font-semibold disabled:opacity-60 ${RAISED_GOLD}`}
              >
                {state === "resuming" ? "Resuming…" : (
                <>
                  <Play aria-hidden fill="currentColor" className="mr-1 inline size-3.5 align-[-2px]" />
                  Resume
                </>
              )}
              </button>
            </section>
          ) : (
          <>
          <div className={`grid items-start gap-4 ${q.vignette ? "lg:grid-cols-2" : ""}`}>
            {q.vignette && (
              // Pinned beside the question: a Level II item set's four questions all read from it, and its scroll stays put between them.
              <section aria-label="Case" className="max-h-[70vh] overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface/60 p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)]">
                <h2 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
                  Vignette{caseRange && `: questions ${caseRange}`}
                </h2>
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
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${mine.flagged ? "border-gold bg-surface-raised text-gold" : "border-line text-muted hover:text-ink"}`}
                >
                  <Flag aria-hidden className="mr-1 inline size-3.5 align-[-2px]" fill={mine.flagged ? "currentColor" : "none"} />
                  {mine.flagged ? "Flagged" : "Flag for review"}
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
              {mine.selected && !checked && (
                <div role="group" aria-label="How sure are you of this answer?" className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">How sure are you?</span>
                  {(
                    [
                      ["sure", "Sure"],
                      ["guess", "A guess"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={mine.confidence === value}
                      onClick={() => change(q.id, { confidence: mine.confidence === value ? null : value })}
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${mine.confidence === value ? (value === "sure" ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-200" : "border-gold bg-surface-raised text-gold") : "border-line text-muted hover:text-ink"}`}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="text-xs text-muted">Guesses come back in your mistakes retake.</span>
                </div>
              )}
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
          </>
          )}
        </main>
      </div>

      <footer className="sticky bottom-0 z-30 border-t border-line bg-canvas/95 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Submit stays on the left, away from Next: a student clicking through on the right never lands on it. */}
          <div className="flex shrink-0 items-center gap-2">
            {checked ? (
              <span className="font-mono text-sm">
                Score {questions.filter((x) => answers[x.id]?.selected === answerKey![x.id]).length}/{questions.length}
                <a href={exitHref} className={`ml-3 rounded-btn px-4 py-2 font-sans font-semibold ${RAISED_GOLD}`}>
                  Done
                </a>
              </span>
            ) : (
            <button type="button" onClick={() => setConfirming(true)} disabled={state === "submitting" || paused} title={paused ? "Resume to submit" : undefined} className={`h-11 rounded-btn px-5 text-sm font-semibold disabled:opacity-60 ${RAISED_GOLD}`}>
              {state === "submitting" ? "Submitting…" : last ? "Submit" : `End session ${session!.index}`}
            </button>
            )}
          </div>
          {/* Phones: the bar above already shows it, and the buttons keep to one row. */}
          <p className="hidden font-mono text-xs text-muted sm:block">
            Progress: {answered}/{questions.length} ({MockGrader.percent(answered, questions.length)}%)
          </p>
          <div className="btn-group min-w-0 flex-1 flex-nowrap! sm:w-64 sm:flex-none">
            <button
              type="button"
              disabled={paused || current === 0}
              onClick={() => setCurrent((c) => c - 1)}
              className={`h-11 px-2 text-sm font-semibold whitespace-nowrap disabled:opacity-40 sm:px-4 ${RAISED_PLAIN}`}
            >
              ‹ Back
            </button>
            <button
              type="button"
              disabled={paused || current === questions.length - 1}
              onClick={() => setCurrent((c) => c + 1)}
              className={`h-11 px-2 text-sm font-semibold whitespace-nowrap disabled:opacity-40 sm:px-4 ${RAISED_QUANT}`}
            >
              Next ›
            </button>
          </div>
        </div>
        {unsaved && !offline && !paused && (
          <p role="status" className="border-t border-red-400/40 bg-red-400/10 px-4 py-2 text-sm text-red-300 sm:px-6">
            Not saved: check your connection. Your answers are kept on this device and save again on their own.
          </p>
        )}
        {(confirming || state === "error") && state !== "submitting" && !paused && (
          <div role="alertdialog" aria-label="Submit the mock" className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 text-sm sm:px-6">
            <p className={state === "error" ? "text-red-300" : "text-ink"}>
              {state === "error"
                ? "Submitting didn't work. Your answers are kept on this device; please try again."
                : unanswered
                  ? `${unanswered} question${unanswered > 1 ? "s are" : " is"} unanswered. ${last ? "Submit anyway?" : "End the session anyway?"}`
                  : last
                    ? "Submit your answers? You can't change them afterwards."
                    : `End session ${session!.index}? Its answers lock, and session ${session!.index + 1} follows after an optional break.`}
            </p>
            <div className="btn-group">
              <button type="button" onClick={() => setConfirming(false)} className={`h-9 px-4 ${RAISED_PLAIN}`}>
                Keep working
              </button>
              <button type="button" onClick={() => void submit()} className={`h-9 px-4 font-semibold ${RAISED_GOLD}`}>
                {last ? "Submit now" : "End session now"}
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
