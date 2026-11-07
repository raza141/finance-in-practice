"use client";

import type { ComponentProps, PointerEvent } from "react";

/** A list-item card with a soft light under the cursor (`.spotlight` in globals.css). Writes two CSS variables, never re-renders. */
export function SpotlightCard({ className = "", onPointerMove, ...props }: ComponentProps<"li">) {
  const move = (event: PointerEvent<HTMLLIElement>) => {
    onPointerMove?.(event);
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };
  return <li {...props} onPointerMove={move} className={`spotlight ${className}`} />;
}
