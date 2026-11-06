"use client";

import { useEffect, useState } from "react";

import { webglAvailable } from "./webgl";

/**
 * True once the browser is idle after load, so WebGL setup (shader compile, context creation)
 * never blocks hydration. With `query`, only when that media query matches (e.g. desktop only).
 * Never true without WebGL: the scene is left out instead of crashing the page.
 */
export function useIdleMount(query?: string): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (query && !window.matchMedia(query).matches) return;
    const done = () => setReady(webglAvailable());
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(done, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(done, 1200); // Safari: no requestIdleCallback
    return () => clearTimeout(id);
  }, [query]);
  return ready;
}
