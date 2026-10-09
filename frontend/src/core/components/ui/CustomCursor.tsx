"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CustomCursorController } from "@/core/animations/CustomCursorController";

const FINE_POINTER = "(pointer: fine)";

/**
 * Global trailing-ring cursor for mouse users. Renders nothing on touch /
 * coarse-pointer devices, where the native cursor hiding in globals.css is
 * also scoped out by the same media query. The admin panel and client
 * invoices keep the native cursor: native dropdowns, date pickers and modal
 * dialogs draw above the page, where the ring can't follow.
 */
export function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const pathname = usePathname();
  const native = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/invoice/");

  useEffect(() => {
    const query = window.matchMedia(FINE_POINTER);
    const sync = () => setEnabled(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!enabled || native || !ref.current || !dotRef.current) return;
    const controller = new CustomCursorController(ref.current, dotRef.current);
    controller.attach();
    return () => controller.detach();
  }, [enabled, native]);

  if (!enabled || native) return null;

  return (
    <>
      {/* Ring colours are set inline by the controller (see CustomCursorController). */}
      <div
        ref={ref}
        data-custom-cursor
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9999] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-solid mix-blend-difference"
      />
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9999] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F8FAFC] mix-blend-difference"
      />
    </>
  );
}
