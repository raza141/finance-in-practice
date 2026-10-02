"use client";

import dynamic from "next/dynamic";

/**
 * WebGL cannot render on the server, so the R3F canvas is code-split and
 * loaded client-side only. `ssr: false` is only permitted inside a Client
 * Component, which is why this thin wrapper exists.
 */
const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse-soft" aria-hidden />,
});

export function HeroScene({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* soft cyan halo behind the mesh */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[15%] rounded-full bg-quant/10 blur-3xl"
      />
      <HeroCanvas />
    </div>
  );
}
