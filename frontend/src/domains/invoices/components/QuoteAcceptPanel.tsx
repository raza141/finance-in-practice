"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/**
 * "Accept this quote" on the client's quote link: their name and a tick for the
 * terms and conditions, no signature. An agreement quote becomes their agreement.
 */
export function QuoteAcceptPanel({ token, agreement }: { token: string; agreement: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" } | { kind: "error"; message: string }>({ kind: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/quote/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: String(form.get("name") ?? ""), acceptTerms: form.get("acceptTerms") === "yes" }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) return setState({ kind: "error", message: body.message ?? "Something went wrong. Please try again." });
      setState({ kind: "done" });
      router.refresh();
    } catch {
      setState({ kind: "error", message: "Couldn't reach the server. Please try again." });
    }
  }

  if (state.kind === "done") {
    return (
      <p role="status" className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800">
        Accepted, thank you. {agreement ? "It is now your agreement, and it shows in your student portal." : "We'll be in touch with the next steps."}
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-slate-300 bg-white p-5 text-sm text-slate-800 print:hidden">
      <h2 className="text-base font-semibold text-slate-900">{agreement ? "Accept this agreement" : "Accept this quote"}</h2>
      <label className="grid gap-1">
        <span className="text-slate-600">Your full name</span>
        <input name="name" required minLength={2} maxLength={120} autoComplete="name" className="rounded-md border border-slate-300 px-3 py-2 text-slate-900" />
      </label>
      <label className="flex items-start gap-2.5">
        <input name="acceptTerms" type="checkbox" value="yes" required className="mt-0.5 h-4 w-4" />
        <span>
          I accept this {agreement ? "agreement" : "quote"} and the{" "}
          <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-slate-900 underline">
            terms and conditions
          </a>
          .
        </span>
      </label>
      {state.kind === "error" && (
        <p role="alert" className="text-red-700">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="justify-self-start rounded-md bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {state.kind === "sending" ? "Accepting…" : "Accept"}
      </button>
      <p className="text-xs text-slate-500">No signature needed: your name and this tick are recorded with the date and time.</p>
    </form>
  );
}
