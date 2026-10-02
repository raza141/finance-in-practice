"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { LandingAnimationController } from "./LandingAnimationController";

/**
 * React adapter for `LandingAnimationController`. Sections opt in with
 * `data-sequence="credentials" | "bento" | "counters" | "reveal"`; every
 * sequence also reveals its `[data-anim="reveal"]` children.
 *
 * The controller is created inside the effect (not during render) so the
 * React Compiler never memoises or re-uses a stale class instance.
 */
export function LandingAnimator({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const controller = new LandingAnimationController(root);
    controller.initHero();

    const sequences = root.querySelectorAll<HTMLElement>("[data-sequence]");
    sequences.forEach((section) => {
      // Every sequence also fades up its own [data-anim="reveal"] children
      // (section headings, copy), so nothing marked for animation stays hidden.
      controller.registerReveal(section);
      switch (section.dataset.sequence) {
        case "credentials":
          controller.registerCredentials(section);
          break;
        case "bento":
          controller.revealBento(section);
          break;
        case "counters":
          controller.registerCounters(section);
          break;
      }
    });

    return () => controller.destroy();
  }, []);

  return (
    <div ref={rootRef} className="contents">
      {children}
    </div>
  );
}
