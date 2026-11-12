"use client";

import { Check, ChevronLeft, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import { BookButton } from "@/core/components/ui/BookButton";
import { RAISED_QUANT } from "@/core/components/ui/buttonStyles";

import { DiagnosticScore } from "../services/DiagnosticScore";

/** One question, rendered on the server (KaTeX, exhibits); the client only tracks picks. */
export interface DiagnosticItem {
  id: string;
  topic: string;
  topicName: string;
  stem: ReactNode;
  options: ReactNode[];
  correct: number;
  /** Its own page, for the answer and worked solution. */
  path: string;
}

const LETTERS = ["A", "B", "C", "D"];

/**
 * The free 10-question diagnostic: one question at a time with "Question n of 10" and a bar,
 * answers held back to the end, then the score and every topic weakest first with a link to practise it.
 */
export function DiagnosticQuiz({ items, level }: { items: DiagnosticItem[]; level: number }) {
  const [picks, setPicks] = useState<(number | null)[]>(() => items.map(() => null));
  const [at, setAt] = useState(0);
  const [done, setDone] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const go = (next: number) => {
    setAt(next);
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  if (done) {
    const result = DiagnosticScore.of(items.map((q, i) => ({ topic: q.topic, correct: q.correct, picked: picks[i] })));
    const byTopic = new Map(items.map((q) => [q.topic, q]));
    return (
      <div ref={top} className="grid scroll-mt-24 gap-6">
        <section aria-labelledby="result-heading" className="rounded-3xl border border-ink/10 bg-canvas/70 p-6 backdrop-blur sm:p-8">
          <h2 id="result-heading" className="text-2xl font-normal italic">
            Your result
          </h2>
          <p className="mt-4 flex items-baseline gap-3">
            <span className="font-mono text-5xl font-bold tabular-nums">
              {result.score}/{result.total}
            </span>
            <span className="font-mono text-sm text-muted tabular-nums">{Math.round((result.score / Math.max(result.total, 1)) * 100)}%</span>
          </p>
          <div className="btn-group mt-6">
            <BookButton track="cfa" />
            <button
              type="button"
              onClick={() => {
                setPicks(items.map(() => null));
                setDone(false);
                go(0);
              }}
              className="inline-flex h-10 items-center gap-2 px-2 text-sm text-muted transition-colors duration-150 hover:text-ink"
            >
              <RotateCcw aria-hidden className="size-4" />
              Start again
            </button>
          </div>
        </section>

        <section aria-labelledby="topics-heading" className="rounded-3xl border border-ink/10 bg-canvas/70 p-3 backdrop-blur sm:p-4">
          <h2 id="topics-heading" className="px-3 pt-2 pb-1 text-lg font-normal italic">
            By topic
          </h2>
          <ul className="grid divide-y divide-line">
            {result.topics.map((t) => {
              const right = t.right === t.total;
              const q = byTopic.get(t.topic)!;
              return (
                <li key={t.topic} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                  <span
                    aria-hidden
                    className={`grid size-9 shrink-0 place-items-center rounded-lg ${right ? "bg-surface-raised text-emerald-300" : "border border-dashed border-gold text-gold"}`}
                  >
                    {right ? <Check strokeWidth={2.25} className="size-[18px]" /> : <X strokeWidth={2.25} className="size-[18px]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{q.topicName}</span>
                    <span className="block text-xs text-muted">
                      {right ? "Right" : "Wrong"} · {t.right} of {t.total}
                    </span>
                  </span>
                  <span className="flex gap-4 text-sm">
                    <Link href={q.path} className="text-quant underline-offset-4 hover:underline">
                      See the answer
                    </Link>
                    <Link href={`/cfa/questions?level=${level}&topic=${t.topic}`} className="text-quant underline-offset-4 hover:underline">
                      Practise
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    );
  }

  const q = items[at];
  const last = at === items.length - 1;
  return (
    <div ref={top} className="scroll-mt-24">
      <div className="flex items-center justify-between gap-4 font-mono text-xs text-muted">
        <span>
          Question <span className="text-ink tabular-nums">{at + 1}</span> of {items.length}
        </span>
        <span className="truncate">{q.topicName}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={at + 1}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-quant transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((at + 1) / items.length) * 100}%` }} />
      </div>

      <section aria-label={`Question ${at + 1}`} className="mt-6 rounded-xl border border-line bg-surface/60 p-5 sm:p-8">
        <div className="text-[1.05rem] leading-relaxed text-ink sm:text-lg">{q.stem}</div>
      </section>

      <fieldset className="mt-6">
        <legend className="sr-only">Select one answer</legend>
        <ul className="grid gap-3">
          {q.options.map((o, i) => {
            const on = picks[at] === i;
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicks((p) => p.map((v, j) => (j === at ? i : v)))}
                  className={`group flex min-h-16 w-full items-center gap-4 rounded-xl border-2 px-4 py-4 text-left text-[1.05rem] leading-relaxed text-ink transition-colors duration-150 sm:gap-5 sm:px-6 sm:text-lg ${
                    on ? "border-quant bg-quant/10" : "border-line bg-surface/40 hover:border-quant/50"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`grid size-10 shrink-0 place-items-center rounded-lg border font-mono text-base font-semibold ${on ? "border-quant bg-quant text-canvas" : "border-line text-muted"}`}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="sr-only">{LETTERS[i]}. </span>
                    {o}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-6 flex items-center justify-between gap-3">
        {at > 0 ? (
          <button type="button" onClick={() => go(at - 1)} className="inline-flex h-11 items-center gap-1 px-2 text-sm text-muted transition-colors duration-150 hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={picks[at] === null}
          onClick={() => (last ? (setDone(true), top.current?.scrollIntoView({ block: "start", behavior: "smooth" })) : go(at + 1))}
          className={`h-11 rounded-btn px-6 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${RAISED_QUANT}`}
        >
          {last ? "See my result" : "Next"}
        </button>
      </div>
    </div>
  );
}
