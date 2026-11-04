"use client";

import { useEffect, useState } from "react";

const SHOW_MS = 8_000;

/** On the results page, once, right after the player submitted: "Submitted" (or "Time's up"). Set by MockPlayer just before its reload. */
export function SubmittedNotice({ attemptId }: { attemptId: string }) {
  const [how, setHow] = useState<string | null>(null);
  useEffect(() => {
    try {
      const key = SubmittedNotice.key(attemptId);
      const value = sessionStorage.getItem(key);
      if (!value) return;
      sessionStorage.removeItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable in the browser
      setHow(value);
    } catch {}
    const timer = window.setTimeout(() => setHow(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [attemptId]);

  if (!how) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-emerald-400/40 bg-canvas/95 p-4 shadow-2xl backdrop-blur-md print:hidden">
      <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-400/20 text-emerald-300">
        ✓
      </span>
      <p className="flex-1 text-sm text-ink">
        <span className="block font-semibold">{how === "auto" ? "Time's up: your answers were submitted" : "Mock submitted"}</span>
        <span className="text-muted">Your answers are saved. Your score and an explanation for every question are below.</span>
      </p>
      <button type="button" onClick={() => setHow(null)} aria-label="Close" className="text-muted hover:text-ink">
        ✕
      </button>
    </div>
  );
}

SubmittedNotice.key = (attemptId: string) => `fip-mock-submitted:${attemptId}`;
