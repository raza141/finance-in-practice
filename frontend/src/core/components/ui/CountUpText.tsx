"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
const NUMBER = /\d[\d,]*(?:\.\d+)?/;

/** The figure at progress t (0..1, eased): its first number scaled, with the same decimals and commas; t = 1 is the text itself. */
export function countUpFrame(text: string, t: number): string {
  const match = text.match(NUMBER);
  if (!match || t >= 1) return text;
  const [raw] = match;
  const decimals = raw.split(".")[1]?.length ?? 0;
  const format = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: raw.includes(","),
  });
  const value = Number(raw.replace(/,/g, "")) * (1 - (1 - Math.max(0, t)) ** 4);
  return (
    text.slice(0, match.index) +
    format.format(value) +
    text.slice((match.index ?? 0) + raw.length)
  );
}

/**
 * Counts up the first number in an already formatted figure ("AED 2,000.00 to pay", "12.5 h left").
 * Runs only when it mounts in the browser (a tab switch), never over server-painted HTML, so the real figure never flashes back to 0.
 * For whole numbers that must count on first paint too, use CountUp (CSS only).
 */
export function CountUpText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const clientMount = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const [animate] = useState(clientMount);

  useLayoutEffect(() => {
    const el = ref.current;
    if (
      !animate ||
      !el ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - start) / 900;
      el.textContent = countUpFrame(text, t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    tick(start);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = text;
    };
  }, [animate, text]);

  return <span ref={ref}>{text}</span>;
}
