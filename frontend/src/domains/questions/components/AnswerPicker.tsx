"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

const CONFETTI = ["#d4af37", "#22d3ee", "#34d399", "#e6c65a", "#22d3ee", "#34d399", "#d4af37", "#f8fafc"];

/**
 * The only script on a question page. Options and the solution arrive already
 * rendered (KaTeX runs on the server), so this just tracks the pick: one answer,
 * then locked, remembered per browser so a refresh keeps it.
 */
export function AnswerPicker({
  storageKey,
  correct,
  options,
  solution,
}: {
  storageKey: string;
  correct: number;
  options: { letter: string; content: ReactNode }[];
  solution: ReactNode;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [fresh, setFresh] = useState(false);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey) ?? NaN);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the reader's earlier answer after hydration
      if (Number.isInteger(saved) && saved >= 0 && saved < options.length) setPicked(saved);
    } catch {}
  }, [storageKey, options.length]);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    setFresh(true);
    try {
      localStorage.setItem(storageKey, String(i));
    } catch {}
  };

  const answered = picked !== null;
  const right = picked === correct;

  return (
    <div>
      <fieldset>
        <legend className="mb-3 text-sm text-muted">{answered ? "Your answer" : "Select one answer"}</legend>
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
                  className={`flex min-h-16 w-full items-center gap-4 rounded-xl border-2 px-4 py-4 text-left text-[1.05rem] leading-relaxed text-ink sm:gap-5 sm:px-6 sm:text-lg transition-[transform,border-color,background-color,box-shadow] duration-200 disabled:cursor-default ${tone} ${celebrate ? "motion-safe:animate-[q-glow_1.2s_ease-out]" : ""} ${isCorrect && fresh && !right ? "motion-safe:animate-[q-pulse_1.4s_ease-out]" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`grid size-10 shrink-0 place-items-center rounded-lg border font-mono text-base font-semibold ${isCorrect ? "border-emerald-400 text-emerald-300" : isWrongPick ? "border-red-400 text-red-300" : "border-line text-muted"}`}
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
                        style={{ background: color, ["--q-angle" as string]: `${k * 45 + 10}deg` }}
                      />
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <p aria-live="polite" className="mt-4 min-h-6 text-sm">
        {answered &&
          (right ? (
            <span className="text-emerald-300">Correct. {options[correct].letter} is the answer.</span>
          ) : (
            <span className="text-red-300">Not quite. The correct answer is {options[correct].letter}.</span>
          ))}
      </p>

      {answered && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="mt-2 inline-flex h-12 items-center rounded-md bg-gold px-6 text-[15px] font-semibold text-canvas transition-colors hover:bg-gold-bright"
        >
          {open ? "Hide solution" : "Show full solution"}
        </button>
      )}
      <div id={panelId} hidden={!open}>
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
