"use client";

import { useActionState } from "react";

import { PendingButton } from "@/domains/admin/components/PendingButton";

import { editTestimonial, type EditResult } from "../actions/moderation";
import { TestimonialContract } from "../services/TestimonialContract";
import type { TestimonialRecord } from "../types";

const { LIMITS } = TestimonialContract;
const FIELD =
  "w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-quant/70";
const LABEL = "text-[11px] tracking-[0.18em] text-muted uppercase";

/** Inline correction of name, role, location and wording, opened from a moderation card. */
export function TestimonialEditForm({ testimonial }: { testimonial: TestimonialRecord }) {
  const [result, action] = useActionState<EditResult, FormData>(editTestimonial, null);

  return (
    <details className="group mt-5 rounded-lg border border-line/70 open:bg-canvas/40">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-sm text-muted transition-colors select-none hover:text-ink">
        <span className="group-open:hidden">Edit name or text</span>
        <span className="hidden group-open:inline">Close editor</span>
      </summary>

      <form action={action} className="grid gap-4 border-t border-line/70 p-4">
        <input type="hidden" name="id" value={testimonial.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className={LABEL}>Name</span>
            <input name="author" defaultValue={testimonial.author} required maxLength={LIMITS.author.max} className={FIELD} />
          </label>
          <label className="grid gap-1.5">
            <span className={LABEL}>Who they are</span>
            <input name="context" defaultValue={testimonial.context} required maxLength={LIMITS.context.max} className={FIELD} />
          </label>
          <label className="grid gap-1.5">
            <span className={LABEL}>City</span>
            <input name="city" defaultValue={testimonial.city ?? ""} maxLength={LIMITS.city.max} className={FIELD} />
          </label>
          <label className="grid gap-1.5">
            <span className={LABEL}>Country</span>
            <input name="country" defaultValue={testimonial.country ?? ""} maxLength={LIMITS.country.max} className={FIELD} />
          </label>
        </div>
        <label className="grid gap-1.5">
          <span className={LABEL}>Note</span>
          <textarea
            name="quote"
            defaultValue={testimonial.quote}
            required
            rows={5}
            minLength={LIMITS.quote.min}
            maxLength={LIMITS.quote.max}
            className={`${FIELD} resize-y leading-relaxed`}
          />
        </label>
        <p className="text-xs text-muted/80">Fix names and typos only. Scores, rating and course stay as the learner submitted them.</p>

        <div className="flex flex-wrap items-center gap-3">
          <PendingButton pendingLabel="Saving…" className="h-9 rounded-md bg-quant/15 px-4 text-sm font-medium text-quant transition-colors hover:bg-quant/25">
            Save changes
          </PendingButton>
          {result?.ok && (
            <p role="status" className="text-sm text-quant">
              Saved.
            </p>
          )}
          {result && !result.ok && (
            <p role="alert" className="text-sm text-gold">
              {result.error}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
