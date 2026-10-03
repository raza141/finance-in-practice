"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/** Client-only loader for the WebGL grid (see HeroScene for why this wrapper exists). */
const DriftingGrid = dynamic(() => import("./DriftingGrid"), { ssr: false });

/**
 * Drifting quant grid behind a section. The WebGL canvas mounts when the
 * section first nears the viewport and stops rendering whenever it leaves.
 */
export function GridBackdrop({ className = "" }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setMounted(true);
      },
      { rootMargin: "25% 0px" },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} aria-hidden className={`pointer-events-none ${className}`}>
      {mounted && <DriftingGrid active={visible} />}
      {/* Fade the grid into the page above and below, and keep the centre calm behind the cards. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#0b1120_0%,transparent_18%,transparent_70%,#0b1120_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_45%,rgb(11_17_32/0.55),transparent_100%)]" />
    </div>
  );
}
