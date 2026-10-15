"use client";

import { useEffect, useState } from "react";

const KEY = "fip-install-hint-dismissed";

/** Chrome/Edge's install event (not in the TS DOM lib). */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

type Mode = { kind: "hidden" } | { kind: "ios" } | { kind: "android" } | { kind: "prompt"; event: InstallPrompt };

/**
 * "Add the portal to your home screen", so students open it like an app
 * instead of hunting through Gmail. Hidden once installed or dismissed.
 */
export function InstallHint() {
  const [mode, setMode] = useState<Mode>({ kind: "hidden" });

  useEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (installed || localStorage.getItem(KEY)) return;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    // Reading the browser once after mount; nothing to sync with React state before that.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ios) setMode({ kind: "ios" });
    else if (/Android/.test(ua)) setMode({ kind: "android" });
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setMode({ kind: "prompt", event: event as InstallPrompt });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode.kind === "hidden") return null;
  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setMode({ kind: "hidden" });
  };

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-3xl border border-quant/30 bg-quant/5 p-5 backdrop-blur-md sm:col-span-2 lg:col-span-3">
      <div className="min-w-56 flex-1 text-sm">
        <p className="font-semibold text-ink">Add the portal to your home screen</p>
        <p className="mt-1 text-ink/80">
          {mode.kind === "ios"
            ? "In Safari, tap Share (the square with an arrow), then “Add to Home Screen”. It opens like an app."
            : mode.kind === "android"
              ? "In Chrome, tap ⋮ (top right), then “Add to Home screen” or “Install app”. It opens like an app."
              : "Install it once and open your sessions, to-do and marks like an app."}
        </p>
      </div>
      {mode.kind === "prompt" && (
        <button
          type="button"
          onClick={() => void mode.event.prompt().finally(dismiss)}
          className="inline-flex h-10 items-center rounded-md bg-quant px-4 text-sm font-semibold text-canvas hover:bg-quant/90"
        >
          Install
        </button>
      )}
      <button type="button" onClick={dismiss} className="text-sm text-muted hover:text-ink">
        Not now
      </button>
    </section>
  );
}
