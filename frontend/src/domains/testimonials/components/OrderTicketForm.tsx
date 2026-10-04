"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { ApiError } from "@/core/http/ApiError";

import { TestimonialApiClient } from "../services/TestimonialApiClient";
import { TestimonialContract, TestimonialValidationError, type SubmitTestimonialRequest } from "../services/TestimonialContract";
import type { OrderSide, Ticker } from "../types";

type Phase = { kind: "editing"; error?: string } | { kind: "sending" } | { kind: "sent" };

const client = new TestimonialApiClient();
const { LIMITS, TICKERS, SIDES, COUNTRIES } = TestimonialContract;

const FIELD =
  "w-full rounded-md border border-line bg-canvas/80 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-quant/70 disabled:opacity-60";

/** Parse a score input; null when blank or not a whole number. */
const score = (raw: string): number | null => (/^\d{1,3}$/.test(raw.trim()) ? Number(raw) : null);

/**
 * "Order Ticket": the public testimonial form, framed as placing a trade.
 * The yield readout uses the same formula and rounding as the database.
 * Submissions wait for admin approval before reaching the order book.
 */
export function OrderTicketForm() {
  const [phase, setPhase] = useState<Phase>({ kind: "editing" });
  const [side, setSide] = useState<OrderSide>("BUY");
  const [ticker, setTicker] = useState<Ticker | "">("");
  const [conviction, setConviction] = useState(8);
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [quoteLength, setQuoteLength] = useState(0);

  const beforeScore = score(before);
  const afterScore = score(after);
  const preview =
    beforeScore !== null && afterScore !== null ? TestimonialContract.yieldPercent(beforeScore, afterScore) : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: SubmitTestimonialRequest = {
      author: String(form.get("author") ?? ""),
      email: String(form.get("email") ?? ""),
      context: String(form.get("context") ?? ""),
      country: String(form.get("country") ?? ""),
      city: String(form.get("city") ?? ""),
      ticker,
      side,
      conviction,
      beforeScore: beforeScore ?? Number.NaN,
      afterScore: afterScore ?? Number.NaN,
      quote: String(form.get("quote") ?? ""),
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
      <div role="status" className="rounded-xl border border-quant/40 bg-canvas/80 p-6 backdrop-blur-md">
        <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">Order received · Pending review</p>
        <h3 className="mt-3 text-2xl">Thank you for sharing.</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Every ticket is reviewed before it reaches the order book. Yours will appear once approved. We&rsquo;ll
          never publish your email.
        </p>
      </div>
    );
  }

  const busy = phase.kind === "sending";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="order-ticket-heading"
      className="relative rounded-xl border border-line bg-canvas/80 backdrop-blur-md"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h3 id="order-ticket-heading" className="text-sm font-semibold tracking-[0.2em] uppercase">
          Testimonial order ticket
        </h3>
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">Limit · Day</span>
      </div>

      <fieldset disabled={busy} className="grid gap-5 p-5">
        {/* Side: BUY / HOLD segmented control */}
        <div role="radiogroup" aria-label="Side" className="grid grid-cols-2 gap-2">
          {(Object.keys(SIDES) as OrderSide[]).map((option) => (
            <label
              key={option}
              className={`cursor-pointer rounded-md border py-2.5 text-center text-sm font-semibold tracking-wider transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-quant ${
                side === option
                  ? option === "BUY"
                    ? "border-quant bg-quant/15 text-quant"
                    : "border-gold bg-gold/15 text-gold"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              <input type="radio" name="side" value={option} checked={side === option} onChange={() => setSide(option)} className="sr-only" />
              {option}
              <span className="block text-[10px] font-normal tracking-normal opacity-80">{SIDES[option]}</span>
            </label>
          ))}
        </div>

        <Field label="Course ticker" hint={ticker ? TICKERS[ticker] : "The programme you took"}>
          <select
            name="ticker"
            required
            value={ticker}
            onChange={(e) => setTicker(TestimonialContract.isTicker(e.target.value) ? e.target.value : "")}
            className={FIELD}
          >
            <option value="" disabled>
              Select…
            </option>
            {(Object.keys(TICKERS) as Ticker[]).map((t) => (
              <option key={t} value={t}>
                {TestimonialContract.SYMBOLS[t]} · {TICKERS[t]}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <div className="flex items-baseline justify-between">
            <div>
              <label htmlFor="conviction" className="text-[11px] tracking-[0.22em] text-muted uppercase">
                Conviction
              </label>
              <p id="conviction-hint" className="mt-1 text-xs text-muted">
                How strongly would you recommend us? Rate from 1 to 10.
              </p>
            </div>
            <output htmlFor="conviction" className="tabular-data text-sm font-semibold text-quant">
              {conviction}/10
            </output>
          </div>
          <input
            id="conviction"
            name="conviction"
            aria-describedby="conviction-hint"
            type="range"
            min={LIMITS.conviction.min}
            max={LIMITS.conviction.max}
            step={1}
            value={conviction}
            onChange={(e) => setConviction(Number(e.target.value))}
            className="mt-3 w-full accent-[var(--color-quant)]"
          />
          <div aria-hidden className="tabular-data mt-1 grid grid-cols-3 text-[10px] text-muted/70">
            <span>1 · Low</span>
            <span className="text-center">Moderate</span>
            <span className="text-right">10 · High</span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
          <Field label="Before %">
            <input
              name="beforeScore"
              inputMode="numeric"
              placeholder="55"
              value={before}
              onChange={(e) => setBefore(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className={`${FIELD} tabular-data`}
            />
          </Field>
          <Field label="After %">
            <input
              name="afterScore"
              inputMode="numeric"
              placeholder="80"
              value={after}
              onChange={(e) => setAfter(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className={`${FIELD} tabular-data`}
            />
          </Field>
          <div className="block">
            <span id="yield-label" className="text-[11px] tracking-[0.22em] text-muted uppercase">
              Yield
            </span>
            <output
              aria-labelledby="yield-label"
              aria-live="polite"
              className={`tabular-data mt-2 block min-w-24 rounded-md border border-line bg-surface px-3 py-2.5 text-right text-sm font-semibold ${
                preview === null ? "text-muted" : preview >= 0 ? "text-quant" : "text-gold"
              }`}
            >
              {preview === null ? "—" : TestimonialContract.formatYield(preview)}
            </output>
          </div>
        </div>
        <p className="-mt-3 text-xs text-muted/80">
          Your score before and after, e.g. mock exam percentages. Yield = (after − before) / before.
        </p>

        <Field label="Note" hint={`${quoteLength} / ${LIMITS.quote.max} · your review, in your own words`}>
          <textarea
            name="quote"
            required
            rows={4}
            minLength={LIMITS.quote.min}
            maxLength={LIMITS.quote.max}
            onChange={(e) => setQuoteLength(e.target.value.length)}
            className={`${FIELD} resize-y font-sans leading-relaxed`}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" hint="Shown publicly">
            <input name="author" required autoComplete="name" maxLength={LIMITS.author.max} className={FIELD} />
          </Field>
          <Field label="Email" hint="Never shown">
            <input name="email" type="email" required autoComplete="email" maxLength={254} className={FIELD} />
          </Field>
        </div>
        <Field label="Who you are" hint="e.g. CFA Level II candidate, MSc Finance at LSE">
          <input name="context" required maxLength={LIMITS.context.max} className={FIELD} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Country">
            <input
              name="country"
              required
              list="order-ticket-countries"
              autoComplete="country-name"
              maxLength={LIMITS.country.max}
              placeholder="Pakistan"
              className={FIELD}
            />
            <datalist id="order-ticket-countries">
              {COUNTRIES.map((country) => (
                <option key={country} value={country} />
              ))}
            </datalist>
          </Field>
          <Field label="City">
            <input
              name="city"
              required
              autoComplete="address-level2"
              maxLength={LIMITS.city.max}
              placeholder="Karachi"
              className={FIELD}
            />
          </Field>
        </div>

        {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" />

        <label className="flex items-start gap-3 text-xs leading-relaxed text-muted">
          <input name="consent" type="checkbox" required className="mt-0.5 h-4 w-4 accent-[var(--color-quant)]" />
          <span className="font-sans">
            I agree that Finance in Practice may publish my name, the details above and my note on its website.
          </span>
        </label>

        {phase.kind === "editing" && phase.error && (
          <p role="alert" className="text-sm text-gold">
            {phase.error}
          </p>
        )}

        <button
          type="submit"
          className="h-12 rounded-md bg-gold font-semibold tracking-wider text-canvas transition-colors hover:bg-gold-bright disabled:opacity-60"
        >
          {busy ? "Routing order…" : `Place ${side} order${ticker ? ` · ${TestimonialContract.SYMBOLS[ticker]}` : ""}`}
        </button>
      </fieldset>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] tracking-[0.22em] text-muted uppercase">{label}</span>
      <span className="mt-2 block">{children}</span>
      {hint && <span className="mt-1.5 block font-sans text-xs text-muted/80">{hint}</span>}
    </label>
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}
