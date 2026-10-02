"use client";

import { useEffect, useRef, useState } from "react";

import { CustomCursorController } from "@/core/animations/CustomCursorController";

const FINE_POINTER = "(pointer: fine)";

/**
 * Global trailing-ring cursor for mouse users. Renders nothing on touch /
 * coarse-pointer devices, where the native cursor hiding in globals.css is
 * also scoped out by the same media query.
 */
export function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(FINE_POINTER);
    const sync = () => setEnabled(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const controller = new CustomCursorController(ref.current);
    controller.attach();
    return () => controller.detach();
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[9999] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F8FAFC]/50 mix-blend-difference"
    />
  );
}
