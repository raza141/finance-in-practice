"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { LandingAnimationController } from "./LandingAnimationController";

/**
 * React adapter for `LandingAnimationController`: plays the hero intro once.
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
    return () => controller.destroy();
  }, []);

  return (
    <div ref={rootRef} className="contents">
      {children}
    </div>
  );
}
