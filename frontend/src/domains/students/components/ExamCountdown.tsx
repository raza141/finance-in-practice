"use client";

import { Eye, EyeOff } from "lucide-react";
import { useSyncExternalStore } from "react";

// ponytail: the choice lives on the device (like the theme); a column on clients if students want it everywhere.
const KEY = "fip-exam-countdown";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));

/** Days to exam as one big figure, which a student who'd rather not see it can hide. */
export function ExamCountdown({ days }: { days: number }) {
  // null on the server and first paint: a student who hid it never sees it flash.
  const hidden = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) === "hidden", () => null);
  const set = (hide: boolean) => {
    if (hide) localStorage.setItem(KEY, "hidden");
    else localStorage.removeItem(KEY);
    listeners.forEach((fn) => fn());
  };
  if (hidden === null) return null;
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
