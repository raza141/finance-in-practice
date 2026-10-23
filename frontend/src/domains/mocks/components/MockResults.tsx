"use client";

import { useState, type ReactNode } from "react";

import { saveMockNote } from "../actions/mocks";
import { MockGrader } from "../services/MockGrader";
import type { MockGrade, OptionLetter } from "../types";

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
  selected: OptionLetter | null;
  flagged: boolean;
  notes: string;
}

type Filter = "all" | "incorrect" | "flagged" | "notes";
const LETTERS: OptionLetter[] = ["A", "B", "C"];
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["incorrect", "Incorrect"],
  ["flagged", "Flagged"],
  ["notes", "Has my notes"],
];

/** The score card, the topic breakdown, and every question to revise, with notes still editable. */
export function MockResults({
  attemptId,
  title,
  grade,
  seconds,
  questions,
}: {
  attemptId: string;
  title: string;
  grade: MockGrade;
  /** Time taken. */
  seconds: number;
  questions: ReviewQuestion[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(questions.map((q) => [q.id, q.notes])));
  const [stored, setStored] = useState(notes);
  const [status, setStatus] = useState<Record<string, "saving" | "saved" | "error" | undefined>>({});

  const shown = questions.filter((q) =>
    filter === "incorrect" ? q.selected !== q.correct : filter === "flagged" ? q.flagged : filter === "notes" ? notes[q.id]?.trim() : true,
  );
  const count = (f: Filter) =>
    f === "all" ? questions.length : f === "incorrect" ? questions.filter((q) => q.selected !== q.correct).length : f === "flagged" ? questions.filter((q) => q.flagged).length : questions.filter((q) => notes[q.id]?.trim()).length;

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

  const pct = MockGrader.percent(grade.score, grade.total);
  return (
    <div className="grid gap-6">
      <section aria-labelledby="score-heading" className="rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.22em] text-quant uppercase">Results</p>
        <h1 id="score-heading" className="mt-1 text-2xl font-normal italic">
          {title}
        </h1>
        <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line [&>div]:bg-surface [&>div]:p-4">
          <div>
            <dt className="text-xs text-muted">Score</dt>
            <dd className="mt-1 font-mono text-2xl">
              {grade.score}/{grade.total}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Percentage</dt>
            <dd className={`mt-1 font-mono text-2xl ${pct >= 70 ? "text-emerald-300" : "text-gold"}`}>{pct}%</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Time taken</dt>
            <dd className="mt-1 font-mono text-2xl">{MockGrader.clock(seconds)}</dd>
          </div>
        </dl>
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
            {grade.topics.map((t) => {
              const p = MockGrader.percent(t.correct, t.total);
              return (
                <tr key={t.topic}>
                  <td className="py-2">{t.topic}</td>
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

      <div role="group" aria-label="Show questions" className="sticky top-16 z-20 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-canvas/90 p-1.5 backdrop-blur-md">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm whitespace-nowrap transition-colors ${filter === id ? "bg-quant/15 font-semibold text-quant" : "text-muted hover:text-ink"}`}
          >
            {label} ({count(id)})
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="text-sm text-muted">No questions here.</p>}
      {shown.map((q) => {
        const right = q.selected === q.correct;
        return (
          <article key={q.id} aria-labelledby={`rq-${q.id}`} className="rounded-2xl border border-line bg-surface/60 p-5 sm:p-6">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={`rq-${q.id}`} className="font-mono text-xs tracking-[0.16em] text-quant uppercase">
                Question {q.number} · {q.topic}
              </h2>
              <span className="flex gap-2 text-xs font-semibold">
                {q.flagged && <span className="text-gold">⚑ Flagged</span>}
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
                  <li
                    key={letter}
                    className={`flex items-center gap-3 rounded-lg border-2 px-4 py-2.5 ${isCorrect ? "border-emerald-400 bg-emerald-400/10" : isWrongPick ? "border-red-400 bg-red-400/10" : "border-line"}`}
                  >
                    <span className="font-mono text-sm text-muted">{letter}</span>
                    <span className="min-w-0 flex-1">{q.options[i]}</span>
                    {letter === q.selected && <span className="text-xs text-muted">Your answer</span>}
                    {isCorrect && <span className="text-xs font-semibold text-emerald-300">Correct answer</span>}
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
          </article>
        );
      })}
    </div>
  );
}
