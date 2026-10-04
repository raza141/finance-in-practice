"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Horizontal, scroll-snapping row. Touch and trackpads swipe natively; the
 * arrow buttons step one card at a time for mouse and keyboard users.
 */
export function SwipeRail({ label, children }: { label: string; children: ReactNode }) {
  const rail = useRef<HTMLOListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () =>
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, []);

  function step(direction: 1 | -1) {
    const el = rail.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: "smooth" });
  }

  const scrollable = !(edges.start && edges.end);

  return (
    <div>
      <ol
        ref={rail}
        aria-label={label}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ol>
      {scrollable && (
        <div className="mt-5 flex justify-end gap-2">
          {([-1, 1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => step(direction)}
              disabled={direction === -1 ? edges.start : edges.end}
              aria-label={direction === -1 ? "Previous testimonial" : "Next testimonial"}
              className="grid h-10 w-10 place-items-center rounded-full border border-line text-muted transition-colors hover:border-quant/60 hover:text-quant disabled:opacity-30 disabled:hover:border-line disabled:hover:text-muted"
            >
              <span aria-hidden>{direction === -1 ? "←" : "→"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
