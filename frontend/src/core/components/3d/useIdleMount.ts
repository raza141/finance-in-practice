"use client";

import { useEffect, useState } from "react";

/**
 * True once the browser is idle after load, so WebGL setup (shader compile, context creation)
 * never blocks hydration. With `query`, only when that media query matches (e.g. desktop only).
 */
export function useIdleMount(query?: string): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (query && !window.matchMedia(query).matches) return;
    const done = () => setReady(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(done, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(done, 1200); // Safari: no requestIdleCallback
    return () => clearTimeout(id);
  }, [query]);
  return ready;
}
