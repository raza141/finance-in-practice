"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { CourseAnimationController } from "./CourseAnimationController";

/** React adapter for `CourseAnimationController`; the controller is created in the effect, never during render. */
export function CourseAnimator({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const controller = new CourseAnimationController(root);
    controller.start();
    return () => controller.destroy();
  }, []);

  return (
    <div ref={rootRef} className="contents">
      {children}
    </div>
  );
}
