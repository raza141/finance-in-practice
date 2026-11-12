"use client";

import { Flag, Share2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { CountUp } from "@/core/components/ui/CountUp";

import { retakeMistakes, saveMockNote } from "../actions/mocks";
import { MockGrader } from "../services/MockGrader";
import type { Confidence, MockGrade, OptionLetter } from "../types";

/** A graded question, rendered on the server (KaTeX included). */
export interface ReviewQuestion {
  id: string;
  number: number;
  topic: string;
  vignette: ReactNode | null;
  question: ReactNode;
  options: [ReactNode, ReactNode, ReactNode];
  correct: OptionLetter;
  explanation: ReactNode | null;
  /** Why each option tempts (null: none written). */
  why: [ReactNode | null, ReactNode | null, ReactNode | null];
  /** Time spent on it; 0 for attempts from before it was tracked. */
  seconds: number;
  confidence: Confidence | null;
  selected: OptionLetter | null;
  flagged: boolean;
  notes: string;
}

/** The two ways to go again, offered under the score. */
export interface RetakeOptions {
  mockId: string;
  fullQuestions: number;
  /** Both sessions of a full mock. */
  fullMinutes: number;
  /** Incorrect, unanswered or flagged. */
  mistakes: number;
  mistakeMinutes: number;
  /** An attempt already open at this mock: either retake resumes it. */
  open: { id: string; mistakes: boolean } | null;
}

type Filter = "all" | "incorrect" | "unanswered" | "flagged" | "guessed" | "slow" | "notes";
const LETTERS: OptionLetter[] = ["A", "B", "C"];
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["incorrect", "Incorrect"],
  ["unanswered", "Unanswered"],
  ["flagged", "Flagged"],
  ["guessed", "Guessed"],
  ["slow", "Slow"],
  ["notes", "Has notes"],
];
/** Over this many times the mock's pace a question counts as slow. */
const SLOW = 2;

/** The score card, the topic breakdown, and the questions to revise one at a time (picked from a numbered grid, as in the exam), with notes still editable. */
export function MockResults({
  attemptId,
  title,
  grade,
  seconds,
  questions,
  paceSeconds = null,
  classAverage = null,
  retake = null,
  readOnly = false,
  shareUrl = null,
}: {
  attemptId: string;
  title: string;
  grade: MockGrade;
  /** Time taken. */
  seconds: number;
  questions: ReviewQuestion[];
  /** The mock's time per question, for "Slow"; null: unknown. */
  paceSeconds?: number | null;
  /** Other students' first attempts at this mock; null: too few to show. */
  classAverage?: { percent: number; students: number } | null;
  retake?: RetakeOptions | null;
  /** The owner reviewing a student's attempt: their notes show, nothing saves. */
  readOnly?: boolean;
  /** Signed public link to this score (no name); null: nothing to share. */
  shareUrl?: string | null;
}) {
  // The owner opens a review to see what went wrong, so it starts on the incorrect ones.
  const [filter, setFilter] = useState<Filter>(readOnly ? "incorrect" : "all");
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(questions.map((q) => [q.id, q.notes])));
  const [stored, setStored] = useState(notes);
  const [status, setStatus] = useState<Record<string, "saving" | "saved" | "error" | undefined>>({});

  const timed = questions.some((q) => q.seconds > 0);
  const keep: Record<Filter, (q: ReviewQuestion) => boolean> = {
    all: () => true,
    incorrect: (q) => q.selected !== q.correct,
    unanswered: (q) => q.selected === null,
    flagged: (q) => q.flagged,
    guessed: (q) => q.confidence === "guess",
    slow: (q) => paceSeconds !== null && q.seconds > SLOW * paceSeconds,
    notes: (q) => !!notes[q.id]?.trim(),
  };
  // A topic picked in the "By topic" table narrows every filter to that topic's questions.
  const [topic, setTopic] = useState<string | null>(null);
  const inTopic = topic ? questions.filter((q) => q.topic === topic) : questions;
  const shown = inTopic.filter(keep[filter]);
  const count = (f: Filter) => inTopic.filter(keep[f]).length;
  const review = useRef<HTMLElement>(null);
  const pickTopic = (t: string) => {
    setTopic(t);
    review.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  // Guessed and Slow only where there's something to show: older attempts have neither.
  const filters = FILTERS.filter(([f]) => (f !== "guessed" && f !== "slow") || (f === "slow" ? timed && paceSeconds !== null : questions.some((q) => q.confidence)));
  const slowRight = paceSeconds === null ? 0 : questions.filter((q) => q.selected === q.correct && q.seconds > SLOW * paceSeconds).length;

  /** On leaving the box, if it changed since the last save. */
  const saveNote = async (id: string) => {
    const value = notes[id] ?? "";
    if (value === stored[id]) return;
    setStatus((s) => ({ ...s, [id]: "saving" }));
    try {
      const { ok } = await saveMockNote(attemptId, id, value);
      if (ok) setStored((s) => ({ ...s, [id]: value }));
      setStatus((s) => ({ ...s, [id]: ok ? "saved" : "error" }));
    } catch {
      setStatus((s) => ({ ...s, [id]: "error" }));
    }
  };

  // One question on screen at a time (as in the exam): a full mock's 180 rendered at once made scrolling and typing crawl.
  const [currentId, setCurrentId] = useState(questions[0]?.id);
  const card = useRef<HTMLElement>(null);
  // A filter that hides the open question opens its first one instead.
  const at = Math.max(0, shown.findIndex((x) => x.id === currentId));
  const q = shown[at];
  const right = q?.selected === q?.correct;
  const go = (id: string) => {
    setCurrentId(id);
    // Back to the top of the question when the last one's explanation left the page scrolled past it.
    if ((card.current?.getBoundingClientRect().top ?? 0) < 0) card.current?.scrollIntoView({ block: "start" });
  };

  // ← / → move Previous / Next, like the buttons; not while typing a note or holding a modifier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      const next = e.key === "ArrowRight" ? shown[at + 1] : e.key === "ArrowLeft" ? shown[at - 1] : undefined;
      if (!next) return;
      e.preventDefault();
      go(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pct = MockGrader.percent(grade.score, grade.total);
  return (
    <div className="grid gap-6">
      <section aria-labelledby="score-heading" className="rounded-3xl border border-ink/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8">
        <h1 id="score-heading" className="text-2xl font-normal italic">
          {title}
        </h1>
        <dl className={`mt-5 grid gap-px overflow-hidden rounded-xl border border-line bg-line [&>div]:bg-surface [&>div]:p-4 ${classAverage ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
          <div>
            <dt className="text-xs text-muted">Score</dt>
            <dd className="mt-1 font-mono text-2xl">
              <CountUp value={grade.score} />/{grade.total}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Percentage</dt>
            <dd className={`mt-1 font-mono text-2xl ${pct >= 70 ? "text-emerald-300" : "text-gold"}`}>
              <CountUp value={pct} suffix="%" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Time taken</dt>
            <dd className="mt-1 font-mono text-2xl">{MockGrader.clock(seconds)}</dd>
            {timed && paceSeconds !== null && (
              <dd className="mt-1 text-xs text-muted">
                {MockGrader.clock(questions.reduce((n, q) => n + q.seconds, 0) / questions.length)} a question; the pace is {MockGrader.clock(paceSeconds)}
              </dd>
            )}
          </div>
          {classAverage && (
            <div>
              <dt className="text-xs text-muted">Class average</dt>
              <dd className="mt-1 font-mono text-2xl">{classAverage.percent}%</dd>
              <dd className="mt-1 text-xs text-muted">{classAverage.students} students</dd>
            </div>
          )}
        </dl>
        <AnswerStrip
          questions={questions}
          current={q?.id}
          onPick={(id) => {
            setFilter("all");
            setCurrentId(id);
            card.current?.scrollIntoView({ block: "start" });
          }}
        />
        {slowRight > 0 && (
          <p className="mt-3 text-sm text-muted">
            {slowRight} right answer{slowRight === 1 ? "" : "s"} took over {SLOW}× the pace. Right but slow costs marks elsewhere on the day: the <span className="text-ink">Slow</span> filter shows
            them.
          </p>
        )}
        {retake && <RetakePanel attemptId={attemptId} retake={retake} questions={questions} />}
        {!readOnly && (
          <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {shareUrl && (
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-btn bg-linkedin px-3.5 font-semibold text-white transition-colors duration-150 hover:bg-linkedin-dark"
              >
                <Share2 aria-hidden className="size-4" />
                Share on LinkedIn
              </a>
            )}
            <Link href={`/student/mocks/${attemptId}/notes`} className="text-quant hover:underline">
              My notes, on one page to print
            </Link>
            <Link href="/student/mocks/notebook" className="text-quant hover:underline">
              Mistakes notebook
            </Link>
          </p>
        )}
        <table className="mt-6 w-full text-sm">
          <caption className="mb-2 text-left font-mono text-[11px] tracking-[0.22em] text-muted uppercase">By topic</caption>
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-2 font-normal">Topic</th>
              <th className="py-2 text-right font-normal">Correct</th>
              <th className="py-2 text-right font-normal">Accuracy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {/* Weakest first: the order to revise in. */}
            {[...grade.topics].sort((a, b) => a.correct / a.total - b.correct / b.total).map((t) => {
              const p = MockGrader.percent(t.correct, t.total);
              return (
                <tr key={t.topic}>
                  <td className="py-2">
                    <button type="button" onClick={() => pickTopic(t.topic)} aria-pressed={topic === t.topic} className={`text-left hover:text-quant hover:underline ${topic === t.topic ? "font-semibold text-quant" : ""}`}>
                      {t.topic}
                    </button>
                  </td>
                  <td className="py-2 text-right font-mono">
                    {t.correct}/{t.total}
                  </td>
                  <td className="py-2 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-line sm:inline-block" aria-hidden>
                        <span className={`block h-full ${p >= 70 ? "bg-emerald-400" : "bg-gold"}`} style={{ width: `${p}%` }} />
                      </span>
                      <span className="w-10 font-mono">{p}%</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section ref={review} aria-label="Review questions" className="scroll-mt-20 grid gap-4 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Questions" className="self-start rounded-2xl border border-ink/10 bg-canvas/90 p-3 lg:sticky lg:top-20">
          <div role="group" aria-label="Show questions" className="grid grid-cols-2 gap-1">
            {filters.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={`rounded-lg px-2 py-1.5 text-xs transition-colors ${filter === id ? "bg-quant/15 font-semibold text-quant" : "text-muted hover:text-ink"}`}
              >
                {label} ({count(id)})
              </button>
            ))}
          </div>
          {topic && (
            <button
              type="button"
              onClick={() => setTopic(null)}
              aria-label={`Show all topics, not only ${topic}`}
              className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg bg-quant/15 px-2 py-1.5 text-left text-xs font-semibold text-quant"
            >
              <span className="truncate">{topic}</span>
              <X aria-hidden className="size-3.5 shrink-0" />
            </button>
          )}
          {/* Capped and scrolling, so a full mock's 180 numbers don't push the question off a phone's screen. */}
          <ol className="mt-3 grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto p-1 sm:grid-cols-12 lg:max-h-[calc(100vh-16rem)] lg:grid-cols-5">
            {shown.map((x) => {
              const tone = x.selected === x.correct ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-200" : x.selected ? "border-red-400/70 bg-red-400/20 text-red-200" : "border-line bg-surface text-muted";
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => go(x.id)}
                    aria-current={x.id === q?.id ? "true" : undefined}
                    aria-label={`Question ${x.number}, ${x.selected === x.correct ? "correct" : x.selected ? "incorrect" : "not answered"}${x.flagged ? ", flagged" : ""}`}
                    className={`relative h-9 w-full rounded-md border font-mono text-xs ${tone} ${x.id === q?.id ? "ring-2 ring-quant ring-offset-2 ring-offset-canvas" : ""}`}
                  >
                    {x.number}
                    {x.flagged && <span aria-hidden className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-gold" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <ul className="mt-3 grid gap-1.5 text-xs text-muted">
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-sm border border-emerald-400/70 bg-emerald-400/20" /> Correct
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-sm border border-red-400/70 bg-red-400/20" /> Incorrect
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-sm border border-line bg-surface" /> Not answered
            </li>
            <li className="flex items-center gap-2">
              <span className="mx-0.5 size-2 rounded-full bg-gold" /> Flagged
            </li>
          </ul>
        </nav>

        {!q ? (
          <p className="text-sm text-muted">No questions here.</p>
        ) : (
          <article ref={card} key={q.id} aria-labelledby={`rq-${q.id}`} className="min-w-0 scroll-mt-20 self-start rounded-2xl border border-line bg-surface/60 p-5 sm:p-6">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={`rq-${q.id}`} className="font-mono text-xs tracking-[0.16em] text-quant uppercase">
                Question {q.number} · {q.topic}
              </h2>
              <span className="flex flex-wrap gap-2 text-xs font-semibold">
                {q.seconds > 0 && (
                  <span className={paceSeconds !== null && q.seconds > SLOW * paceSeconds ? "text-gold" : "font-normal text-muted"}>{MockGrader.clock(q.seconds)}</span>
                )}
                {q.confidence && <span className="font-normal text-muted">{q.confidence === "sure" ? (readOnly ? "They were sure" : "You were sure") : readOnly ? "Their guess" : "Your guess"}</span>}
                {q.flagged && (
                  <span className="inline-flex items-center gap-1 text-gold">
                    <Flag aria-hidden fill="currentColor" className="size-3" />
                    Flagged
                  </span>
                )}
                <span className={right ? "text-emerald-300" : "text-red-300"}>{right ? "Correct" : q.selected ? "Incorrect" : "Not answered"}</span>
              </span>
            </header>
            {q.vignette && <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-line bg-canvas/40 p-4 text-sm text-ink/90">{q.vignette}</div>}
            <div className="mt-3 leading-relaxed">{q.question}</div>
            <ul className="mt-4 grid gap-2">
              {LETTERS.map((letter, i) => {
                const isCorrect = letter === q.correct;
                const isWrongPick = letter === q.selected && !isCorrect;
                return (
                  <li key={letter} className={`rounded-lg border-2 px-4 py-2.5 ${isCorrect ? "border-emerald-400 bg-emerald-400/10" : isWrongPick ? "border-red-400 bg-red-400/10" : "border-line"}`}>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-sm text-muted">{letter}</span>
                      <span className="min-w-0 flex-1">{q.options[i]}</span>
                      {letter === q.selected && <span className="text-xs text-muted">{readOnly ? "Their answer" : "Your answer"}</span>}
                      {isCorrect && <span className="text-xs font-semibold text-emerald-300">Correct answer</span>}
                    </span>
                    {/* Why a wrong option tempts: in full for their own pick, quieter for the others. */}
                    {!isCorrect && q.why[i] && <span className={`mt-1 block pl-7 text-sm ${isWrongPick ? "text-ink/90" : "text-muted"}`}>{q.why[i]}</span>}
                  </li>
                );
              })}
            </ul>
            {q.explanation && (
              <section className="mt-4 border-l-2 border-emerald-400/60 pl-4">
                <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Explanation</h3>
                <div className="mt-2 text-ink/90">{q.explanation}</div>
              </section>
            )}
            {readOnly ? (
              notes[q.id]?.trim() && (
                <div className="mt-4">
                  <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Their notes</h3>
                  <p className="mt-2 font-mono text-sm whitespace-pre-wrap text-ink/90">{notes[q.id]}</p>
                </div>
              )
            ) : (
              <div className="mt-4">
                <label htmlFor={`note-${q.id}`} className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
                  My notes
                </label>
                <textarea
                  id={`note-${q.id}`}
                  value={notes[q.id] ?? ""}
                  maxLength={5000}
                  rows={3}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNotes((n) => ({ ...n, [q.id]: value }));
                    setStatus((s) => ({ ...s, [q.id]: undefined }));
                  }}
                  onBlur={() => void saveNote(q.id)}
                  placeholder="Add a revision note…"
                  className="mt-2 w-full rounded-md border border-line bg-canvas/80 px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-muted/50 focus:border-quant/70"
                />
                <p aria-live="polite" className="min-h-5 text-xs text-muted">
                  {status[q.id] === "saving" ? "Saving…" : status[q.id] === "saved" ? "Saved." : status[q.id] === "error" ? "Couldn't save. Click outside the box to retry." : ""}
                </p>
              </div>
            )}
            <footer className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
              <button type="button" disabled={at <= 0} onClick={() => go(shown[at - 1].id)} className="h-10 rounded-md border border-line px-4 text-sm disabled:opacity-40">
                ‹ Previous
              </button>
              <span className="font-mono text-xs text-muted">
                {at + 1} of {shown.length}
              </span>
              <button type="button" disabled={at >= shown.length - 1} onClick={() => go(shown[at + 1].id)} className="h-10 rounded-md border border-line px-4 text-sm disabled:opacity-40">
                Next ›
              </button>
            </footer>
          </article>
        )}
      </section>
    </div>
  );
}

const segmentTone = (q: Pick<ReviewQuestion, "selected" | "correct">) => (q.selected === q.correct ? "bg-emerald-400" : q.selected ? "bg-red-400" : "bg-line");
const segmentState = (q: Pick<ReviewQuestion, "selected" | "correct">) => (q.selected === q.correct ? "correct" : q.selected ? "incorrect" : "not answered");

/**
 * The whole attempt in one line, in the order it was sat: a segment per question, a gold tick over the flagged ones.
 * A pointer shortcut only: the numbered grid below is the keyboard and screen-reader way to the same questions.
 */
function AnswerStrip({ questions, current, onPick }: { questions: ReviewQuestion[]; current?: string; onPick: (id: string) => void }) {
  return (
    <ol aria-hidden className={`mt-5 flex h-7 items-end ${questions.length > 60 ? "" : "gap-px"}`}>
      {questions.map((x) => (
        <li key={x.id} className="relative h-full min-w-0 flex-1">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onPick(x.id)}
            title={`Question ${x.number}: ${segmentState(x)}${x.flagged ? ", flagged" : ""}`}
            // Grows by transform, not height; still under reduced motion.
            className={`absolute inset-x-0 bottom-0 h-6 origin-bottom rounded-[1px] transition-transform hover:scale-y-100 motion-reduce:transition-none ${segmentTone(x)} ${x.id === current ? "scale-y-100" : "scale-y-[0.66]"}`}
          />
          {x.flagged && <span aria-hidden className="absolute inset-x-0 top-0 mx-auto h-1 w-full max-w-1.5 rounded-full bg-gold" />}
        </li>
      ))}
    </ol>
  );
}

/** Go again: the whole mock reshuffled, or only what went wrong. An open retake is resumed instead. */
function RetakePanel({ attemptId, retake, questions }: { attemptId: string; retake: RetakeOptions; questions: ReviewQuestion[] }) {
  if (retake.open) {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-surface-raised p-4 text-sm">
        <p>You have {retake.open.mistakes ? "a mistakes retake" : "a retake of the whole mock"} open. Finish it before starting another.</p>
        <Link href={`/student/mocks/${retake.open.id}`} className="rounded-md bg-gold px-4 py-2 font-semibold text-canvas hover:bg-gold-bright">
          Resume
        </Link>
      </div>
    );
  }
  const wrong = questions.filter((q) => q.selected && q.selected !== q.correct).length;
  const blank = questions.filter((q) => !q.selected).length;
  const lucky = questions.filter((q) => q.flagged && q.selected === q.correct).length;
  const parts = [
    wrong && `${wrong} incorrect`,
    blank && `${blank} unanswered`,
    lucky && `${lucky} flagged but right`,
  ].filter(Boolean);
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface/60 p-4">
        <div>
          <h2 className="font-semibold">Whole mock again</h2>
          <p className="mt-1 text-sm text-muted">
            All {retake.fullQuestions} questions in a new order, {retake.fullMinutes} min. Every mark is kept.
          </p>
        </div>
        <Link href={`/student/mocks/start/${retake.mockId}`} className="mt-auto self-start rounded-md border border-line px-4 py-2 text-sm hover:border-quant/60">
          Retake whole mock
        </Link>
      </div>
      <form action={retakeMistakes} className="flex flex-col gap-3 rounded-xl border border-gold/40 bg-surface-raised p-4">
        <input type="hidden" name="attemptId" value={attemptId} />
        <div>
          <h2 className="font-semibold">Only my mistakes</h2>
          <p className="mt-1 text-sm text-muted">
            {retake.mistakes
              ? `${retake.mistakes} question${retake.mistakes === 1 ? "" : "s"}: ${parts.join(", ")}. ${retake.mistakeMinutes} min, at the mock's pace. Doesn't count in Progress.`
              : "Nothing to retake: every answer was right and nothing was flagged."}
          </p>
        </div>
        <button type="submit" disabled={!retake.mistakes} className="mt-auto self-start rounded-btn bg-gold px-4 py-2 text-sm font-semibold text-canvas hover:bg-gold-bright disabled:opacity-40">
          {retake.mistakes ? `Retake ${retake.mistakes} question${retake.mistakes === 1 ? "" : "s"}` : "Retake mistakes"}
        </button>
      </form>
    </div>
  );
}
