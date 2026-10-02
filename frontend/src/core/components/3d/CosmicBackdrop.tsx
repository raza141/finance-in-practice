"use client";

import { useState } from "react";

import { CosmicScene } from "./CosmicScene";
import { CosmicState } from "./CosmicState";

/** Ambient (non-scroll-driven) vortex for full-bleed page heroes. */
export function CosmicBackdrop({ tilt = 1.05, zoom = 8.5, className = "" }: { tilt?: number; zoom?: number; className?: string }) {
  const [state] = useState(() => Object.assign(new CosmicState(), { tilt, zoom }));
  return <CosmicScene state={state} className={className} />;
}
