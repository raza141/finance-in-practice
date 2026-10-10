"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { BookButton } from "@/core/components/ui/BookButton";

/**
 * Phone-only booking bar, Apple "Buy" style: slides up once the visitor is past
 * the first screen and hides while the page's own #book panel, or any
 * `[data-hide-bookbar]` block (lead forms), is on screen.
 * Sets `data-bookbar` on <html> so the WhatsApp button can step above it.
 */
export function StickyBookBar() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // The bar steps aside for the page's own booking panel and for lead forms it would cover.
    const inView = new Set<Element>();
    const update = () => {
      const on = window.scrollY > window.innerHeight * 0.8 && inView.size === 0;
      setShow(on);
      document.documentElement.toggleAttribute("data-bookbar", on);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) inView.add(entry.target);
        else inView.delete(entry.target);
      }
      update();
    });
    document.querySelectorAll("#book, [data-hide-bookbar]").forEach((el) => observer.observe(el));
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      document.documentElement.removeAttribute("data-bookbar");
    };
  }, [pathname]);

  return (
    <div
      inert={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-canvas/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-transform duration-300 lg:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">Free diagnostic session</p>
          <p className="truncate text-xs text-muted">30 min · Abu Dhabi or online</p>
        </div>
        <BookButton label="Book now" className="shrink-0" />
      </div>
    </div>
  );
}
