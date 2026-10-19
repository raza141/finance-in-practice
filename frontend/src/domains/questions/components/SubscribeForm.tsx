"use client";

import { useState, type FormEvent } from "react";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string } | { kind: "done" };

/** "Get tomorrow's CFA question": saves the email as a lead; the daily email goes out once the owner switches it on. */
export function SubscribeForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/cfa/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), website: form.get("website") }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(body.message || "Something went wrong. Please retry.");
      setState({ kind: "done" });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Something went wrong. Please retry." });
    }
  };

  if (state.kind === "done") {
    return (
      <p role="status" className="text-sm text-ink">
        You&rsquo;re on the list. Tomorrow&rsquo;s question will come to your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="qotd-email">
          Email address
        </label>
        <input
          id="qotd-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          className="h-12 min-w-0 flex-1 rounded-md border border-line bg-canvas px-4 text-ink placeholder:text-muted/70 focus:border-quant"
        />
        <button
          type="submit"
          disabled={state.kind === "sending"}
          className="h-12 shrink-0 rounded-md bg-gold px-6 text-[15px] font-semibold text-canvas transition-colors hover:bg-gold-bright disabled:opacity-60"
        >
          {state.kind === "sending" ? "Sending…" : "Send me the questions"}
        </button>
      </div>
      {/* Honeypot: hidden from people, filled by bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <p className="text-xs text-muted">
        See our{" "}
        <a href="/privacy" className="underline underline-offset-2 hover:text-quant">
          Privacy Policy
        </a>
        .
      </p>
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-gold">
          {state.message}
        </p>
      )}
    </form>
  );
}
