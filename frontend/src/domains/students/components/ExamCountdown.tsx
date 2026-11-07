"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { setExamCountdownHidden } from "../actions/myPlan";

/** Days to exam as one big figure, which a student who'd rather not see it can hide (saved on their account). */
export function ExamCountdown({ days, hidden: saved, readOnly }: { days: number; hidden: boolean; readOnly: boolean }) {
  const [hidden, setHidden] = useState(saved);
  const set = (hide: boolean) => {
    setHidden(hide);
    // The owner viewing as the student only flips it on screen.
    if (!readOnly) void setExamCountdownHidden(hide);
  };
  const toggle = "inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.22em] text-muted uppercase hover:text-ink";
  return hidden ? (
    <button type="button" onClick={() => set(false)} className={toggle}>
      <Eye aria-hidden strokeWidth={1.75} className="size-4" />
      Show days to exam
    </button>
  ) : (
    <span className="inline-flex items-baseline gap-3">
      {days === 0 ? (
        <span className="font-mono text-2xl font-bold text-gold">Exam today</span>
      ) : (
        <span className="inline-flex items-baseline gap-2">
          <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Exam in</span>
          <span className="font-mono text-3xl font-bold text-gold tabular-nums">{days}</span>
          <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">days</span>
        </span>
      )}
      <button type="button" onClick={() => set(true)} className={toggle}>
        <EyeOff aria-hidden strokeWidth={1.75} className="size-4" />
        Hide
      </button>
    </span>
  );
}
