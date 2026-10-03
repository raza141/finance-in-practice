"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

interface TiltSurfaceProps {
  children: ReactNode;
  /** Maximum rotation in degrees on each axis. */
  maxTilt?: number;
  className?: string;
}

/**
 * Subtle physical 3D tilt that follows the cursor.
 *
 * The transform is written straight to the DOM in a rAF callback rather than
 * through React state, so mouse movement never re-renders the (heavy) child.
 */
export function TiltSurface({ children, maxTilt = 2.5, className = "" }: TiltSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const apply = (rotateX: number, rotateY: number) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (surfaceRef.current) {
        surfaceRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }
    });
  };

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    // Clamped to -0.5 .. 0.5: overflowing children (e.g. a dropdown) report points outside rect.
    const clamp = (v: number) => Math.max(-0.5, Math.min(0.5, v));
    const x = clamp((event.clientX - rect.left) / rect.width - 0.5);
    const y = clamp((event.clientY - rect.top) / rect.height - 0.5);
    // Cursor at the top tips the top edge away; cursor right turns the right edge away.
    apply(-y * 2 * maxTilt, x * 2 * maxTilt);
  };

  return (
    <div className={`[perspective:1400px] ${className}`} onMouseMove={onMouseMove} onMouseLeave={() => apply(0, 0)}>
      <div
        ref={surfaceRef}
        className="transition-transform duration-300 ease-out will-change-transform [transform-style:preserve-3d]"
      >
        {children}
      </div>
    </div>
  );
}
