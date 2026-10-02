"use client";

import dynamic from "next/dynamic";

import type { CosmicState } from "./CosmicState";

/** Client-only loader for the WebGL vortex (see HeroScene for why this wrapper exists). */
const CosmicVortex = dynamic(() => import("./CosmicVortex"), { ssr: false });

export function CosmicScene({ state, className = "" }: { state: CosmicState; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none ${className}`}>
      <CosmicVortex state={state} />
      {/* Vignette keeps foreground copy readable over the brightest arms. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgb(11_17_32/0.55)_65%,#0b1120_100%)]" />
      {/* Dark pool under the centre of the viewport, where headings and body copy sit. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_35%_at_50%_58%,rgb(11_17_32/0.75),transparent_100%)]" />
    </div>
  );
}
