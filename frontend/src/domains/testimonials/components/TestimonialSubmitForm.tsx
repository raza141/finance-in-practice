"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { ApiError } from "@/core/http/ApiError";

import { TestimonialApiClient } from "../services/TestimonialApiClient";
import { TestimonialContract, TestimonialValidationError } from "../services/TestimonialContract";

type Phase = { kind: "editing"; error?: string } | { kind: "sending" } | { kind: "sent" };

const client = new TestimonialApiClient();
const { LIMITS, PROGRAMS } = TestimonialContract;

const FIELD =
  "w-full rounded-md border border-line bg-canvas/70 px-3 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-quant/70 disabled:opacity-60";

/** Public "share your experience" form. Submissions wait for admin approval. */
export function TestimonialSubmitForm() {
  const [phase, setPhase] = useState<Phase>({ kind: "editing" });
  const [quoteLength, setQuoteLength] = useState(0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      author: String(form.get("author") ?? ""),
      email: String(form.get("email") ?? ""),
      context: String(form.get("context") ?? ""),
      program: String(form.get("program") ?? ""),
      quote: String(form.get("quote") ?? ""),
      outcome: String(form.get("outcome") ?? ""),
      consent: form.get("consent") === "on",
      website: String(form.get("website") ?? ""),
    };

    try {
      TestimonialContract.parseSubmission(body);
    } catch (error) {
      if (error instanceof TestimonialValidationError) {
        setPhase({ kind: "editing", error: capitalise(error.message) });
        return;
      }
      throw error;
    }

    setPhase({ kind: "sending" });
    try {
      await client.submit(body);
      setPhase({ kind: "sent" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Something went wrong. Please retry.";
      setPhase({ kind: "editing", error: message });
    }
  }

  if (phase.kind === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-quant/40 bg-canvas/60 p-8 backdrop-blur-md">
        <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">Received</p>
        <h2 className="mt-3 text-3xl font-normal tracking-tight italic">Thank you for sharing.</h2>
        <p className="mt-3 max-w-lg leading-relaxed text-muted">
          We read every testimonial before it goes on the site. Yours will appear once it&rsquo;s been
          reviewed. We&rsquo;ll never publish your email.
        </p>
      </div>
    );
  }

  const busy = phase.kind === "sending";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="relative grid gap-5 rounded-2xl border border-white/10 bg-canvas/60 p-6 backdrop-blur-md sm:grid-cols-2 sm:p-8"
    >
      <Field label="Your name" hint="Shown publicly">
        <input name="author" required autoComplete="name" maxLength={LIMITS.author.max} disabled={busy} className={FIELD} />
      </Field>
      <Field label="Email" hint="Never shown. Only to verify you.">
        <input name="email" type="email" required autoComplete="email" maxLength={254} disabled={busy} className={FIELD} />
      </Field>
      <Field label="Who you are" hint="e.g. CFA Level II candidate, MSc Finance at LSE">
        <input name="context" required maxLength={LIMITS.context.max} disabled={busy} className={FIELD} />
      </Field>
      <Field label="Course or service">
        <select name="program" required defaultValue="" disabled={busy} className={FIELD}>
          <option value="" disabled>
            Choose one
          </option>
          {PROGRAMS.map((program) => (
            <option key={program} value={program}>
              {program}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Your testimonial" hint={`${quoteLength} / ${LIMITS.quote.max}. Two or three sentences in your own words.`}>
          <textarea
            name="quote"
            required
            rows={5}
            minLength={LIMITS.quote.min}
            maxLength={LIMITS.quote.max}
            onChange={(e) => setQuoteLength(e.target.value.length)}
            disabled={busy}
            className={`${FIELD} resize-y`}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Outcome (optional)" hint="e.g. Passed CFA Level I, May 2026">
          <input name="outcome" maxLength={LIMITS.outcome.max} disabled={busy} className={FIELD} />
        </Field>
      </div>

      {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-px w-px opacity-0"
      />

      <label className="flex items-start gap-3 text-sm leading-relaxed text-muted sm:col-span-2">
        <input name="consent" type="checkbox" required disabled={busy} className="mt-1 h-4 w-4 accent-[var(--color-quant)]" />
        <span>
          I agree that Finance in Practice may publish my name, the details above and my testimonial on
          its website.
        </span>
      </label>

      {phase.kind === "editing" && phase.error && (
        <p role="alert" className="text-sm text-gold sm:col-span-2">
          {phase.error}
        </p>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 items-center justify-center rounded-md bg-gold px-6 text-[15px] font-semibold text-canvas transition-colors hover:bg-gold-bright disabled:opacity-60"
        >
          {busy ? "Sending…" : "Submit testimonial"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">{label}</span>
      <span className="mt-2 block">{children}</span>
      {hint && <span className="mt-1.5 block text-xs text-muted/80">{hint}</span>}
    </label>
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}
