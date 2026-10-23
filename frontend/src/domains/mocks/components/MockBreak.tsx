"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { startNextSession } from "../actions/mocks";
import { MockGrader } from "../services/MockGrader";

/**
 * Between a full mock's sessions: an optional break, like the exam's. Session 2's clock starts
 * when the countdown ends, or now with the button. The end time is the server's.
 */
export function MockBreak({ attemptId, title, remainingMs, next }: { attemptId: string; title: string; remainingMs: number; next: number }) {
  const router = useRouter();
  const [deadline] = useState(() => Date.now() + remainingMs);
  const [left, setLeft] = useState(Math.ceil(remainingMs / 1000));
  useEffect(() => {
    const timer = window.setInterval(() => {
      const s = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        window.clearInterval(timer);
        router.refresh();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, router]);

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <section aria-labelledby="break-heading" className="w-full max-w-lg rounded-3xl border border-white/10 bg-canvas/70 p-8 text-center backdrop-blur-md">
        <p className="font-mono text-[11px] tracking-[0.22em] text-quant uppercase">{title}</p>
        <h1 id="break-heading" className="mt-2 text-2xl font-normal italic">
          Session {next - 1} done. Optional break.
        </h1>
        <p role="timer" aria-label="Break time left" className="mt-6 font-mono text-5xl tabular-nums">
          {MockGrader.clock(left)}
        </p>
        <p className="mt-4 text-sm text-muted">
          Session {next - 1}&rsquo;s answers are locked. Session {next} starts on its own when the break ends, so be back before then; or start it now.
        </p>
        <form action={startNextSession} className="mt-6">
          <input type="hidden" name="attemptId" value={attemptId} />
          <button type="submit" className="h-11 rounded-md bg-gold px-6 font-semibold text-canvas hover:bg-gold-bright">
            Start session {next} now
          </button>
        </form>
      </section>
    </div>
  );
}
