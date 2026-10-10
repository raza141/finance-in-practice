"use client";

import { useState, type FormEvent } from "react";

import { BookButton } from "@/core/components/ui/BookButton";

import type { FreeResource } from "../services/ResourceCatalog";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string } | { kind: "done"; url: string; emailed: boolean };

/**
 * Email in, download out. The download is a link the visitor taps (iOS blocks
 * downloads started after an await), and the booking button sits right beside it:
 * a new lead is the warmest prospect on the site.
 */
export function LeadForm({ resource, source }: { resource: FreeResource; source: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          resource: resource.id,
          source,
          marketingOptIn: form.get("optIn") === "on",
          website: form.get("website"),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { url?: string; emailed?: boolean; message?: string };
      if (!response.ok || !body.url) throw new Error(body.message || "Something went wrong. Please retry.");
      setState({ kind: "done", url: body.url, emailed: body.emailed === true });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Something went wrong. Please retry." });
    }
  };

  if (state.kind === "done") {
    return (
      <div role="status" className="grid gap-3">
        <p className="text-sm text-ink">It&rsquo;s yours.{state.emailed && " A copy is on its way to your inbox too."}</p>
        <a
          href={state.url}
          download
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-quant/60 px-6 font-mono text-[15px] font-semibold text-quant transition-colors hover:bg-quant/10"
        >
          ↓ Download {resource.title}
        </a>
        <BookButton label="Book free diagnostic session" size="lg" />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor={`lead-email-${source}`}>
          Email address
        </label>
        <input
          id={`lead-email-${source}`}
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
          className="h-12 shrink-0 rounded-md bg-gold px-6 font-mono text-[15px] font-semibold text-canvas transition-colors hover:bg-gold-bright disabled:opacity-60"
        >
          {state.kind === "sending" ? "Sending…" : "Get it free"}
        </button>
      </div>
      {/* Honeypot: hidden from people, filled by bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" name="optIn" className="mt-0.5 accent-[#22d3ee]" />
        Also send me occasional CFA/FRM exam tips. Unsubscribe anytime.
      </label>
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-gold">
          {state.message}
        </p>
      )}
    </form>
  );
}
