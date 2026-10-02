"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { CosmicScrollController } from "@/core/animations/CosmicScrollController";

import { CosmicScene } from "./CosmicScene";
import { CosmicState } from "./CosmicState";

interface CosmicScrollStageProps {
  /** An intro `[data-cosmic-section]` followed by one section per stop. */
  children: ReactNode;
  /** Number of stops after the intro; one progress dot each. */
  count: number;
  className?: string;
}

/**
 * Sticky cosmic vortex behind a run of full-viewport sections, retargeting
 * the camera as each one scrolls through. The WebGL scene mounts when the
 * stage first nears the viewport and stops rendering whenever it leaves.
 */
export function CosmicScrollStage({ children, count, className = "" }: CosmicScrollStageProps) {
  const root = useRef<HTMLDivElement>(null);
  const [state] = useState(() => new CosmicState());
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!root.current) return;
    const controller = new CosmicScrollController(root.current, state);
    controller.attach();
    return () => controller.detach();
  }, [state]);

  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setMounted(true);
      },
      { rootMargin: "50% 0px" },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root} className={`relative ${className}`}>
      {/* Absolute track + sticky child pins the stage only within this section. */}
      <div className="absolute inset-0">
        <div className="sticky top-0 h-screen w-full">
          {mounted && <CosmicScene state={state} active={visible} className="absolute inset-0" />}
          <ol
            aria-hidden
            className="absolute top-1/2 right-4 hidden -translate-y-1/2 flex-col gap-3 lg:flex"
          >
            {Array.from({ length: count }, (_, i) => (
              <li
                key={i}
                data-cosmic-dot
                data-active="false"
                className="h-8 w-px bg-white/20 transition-all duration-500 data-[active=true]:h-14 data-[active=true]:bg-quant data-[active=true]:shadow-[0_0_10px_rgb(34_211_238/0.9)]"
              />
            ))}
          </ol>
        </div>
      </div>

      <div className="relative">{children}</div>
    </div>
  );
}
