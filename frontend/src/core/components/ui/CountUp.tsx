import type { CSSProperties } from "react";

/** A figure that counts up from 0 on paint (`.count-up` in globals.css). Screen readers get the real value; works in server components. */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const to = Math.round(value);
  return (
    <>
      <span className="sr-only">
        {to}
        {suffix}
      </span>
      <span aria-hidden className="count-up tabular-nums" data-suffix={suffix} style={{ "--count-to": to } as CSSProperties} />
    </>
  );
}
