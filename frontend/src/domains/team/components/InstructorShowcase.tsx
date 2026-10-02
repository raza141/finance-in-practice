"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { CosmicScene } from "@/core/components/3d/CosmicScene";
import { CosmicState } from "@/core/components/3d/CosmicState";

import { InstructorScrollController } from "../animations/InstructorScrollController";

interface InstructorShowcaseProps {
  /** Intro section followed by one InstructorProfile per instructor. */
  children: ReactNode;
  count: number;
}

/**
 * Scroll stage for /about: a sticky cosmic vortex sits behind the page while
 * each instructor section scrolls through, retargeting the camera as it goes.
 */
export function InstructorShowcase({ children, count }: InstructorShowcaseProps) {
  const root = useRef<HTMLDivElement>(null);
  const [state] = useState(() => new CosmicState());

  useEffect(() => {
    if (!root.current) return;
    const controller = new InstructorScrollController(root.current, state);
    controller.attach();
    return () => controller.detach();
  }, [state]);

  return (
    <div ref={root} className="relative -mt-20">
      {/* Absolute track + sticky child pins the stage only within this section. */}
      <div className="absolute inset-0">
        <div className="sticky top-0 h-screen w-full">
          <CosmicScene state={state} className="absolute inset-0" />
          <ol
            aria-hidden
            className="absolute top-1/2 right-4 hidden -translate-y-1/2 flex-col gap-3 lg:flex"
          >
            {Array.from({ length: count }, (_, i) => (
              <li
                key={i}
                data-instructor-dot
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
