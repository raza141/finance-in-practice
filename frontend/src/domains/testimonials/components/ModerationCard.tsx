import { PendingButton } from "@/domains/admin/components/PendingButton";

import { deleteTestimonial, setTestimonialStatus } from "../actions/moderation";
import { TestimonialContract } from "../services/TestimonialContract";
import type { TestimonialRecord, TestimonialStatus } from "../types";

const ACTIONS: Record<TestimonialStatus, { to: TestimonialStatus; label: string; tone: string }[]> = {
  pending: [
    { to: "approved", label: "Approve", tone: "bg-quant/15 text-quant hover:bg-quant/25" },
    { to: "rejected", label: "Reject", tone: "text-muted hover:text-ink" },
  ],
  approved: [{ to: "pending", label: "Unpublish", tone: "text-muted hover:text-ink" }],
  rejected: [
    { to: "approved", label: "Approve", tone: "bg-quant/15 text-quant hover:bg-quant/25" },
    { to: "pending", label: "Back to pending", tone: "text-muted hover:text-ink" },
  ],
};

const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" });

/** One testimonial in the admin queue, with its moderation buttons. */
export function ModerationCard({ testimonial }: { testimonial: TestimonialRecord }) {
  return (
    <article className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold">{testimonial.author}</h3>
        <time dateTime={testimonial.submittedAt} className="font-mono text-xs text-muted">
          {DATE.format(new Date(testimonial.submittedAt))}
        </time>
      </header>
      <p className="mt-1 text-sm text-muted">
        {testimonial.context}
        {!testimonial.fill && testimonial.program && <span className="text-quant"> · {testimonial.program}</span>} ·{" "}
        <a href={`mailto:${testimonial.email}`} className="underline decoration-line underline-offset-2 hover:text-ink">
          {testimonial.email}
        </a>
      </p>
      {testimonial.fill && (
        <p className="tabular-data mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className={testimonial.fill.side === "BUY" ? "text-quant" : "text-gold"}>{testimonial.fill.side}</span>
          <span className="text-ink">{testimonial.fill.ticker}</span>
          <span>Conviction {testimonial.fill.conviction}/10</span>
          <span>
            {testimonial.fill.beforeScore}% → {testimonial.fill.afterScore}%
          </span>
          <span className={testimonial.fill.yieldPercent >= 0 ? "text-quant" : "text-gold"}>
            Yield {TestimonialContract.formatYield(testimonial.fill.yieldPercent)}
          </span>
        </p>
      )}
      <blockquote className="mt-4 border-l-2 border-gold/60 pl-4 leading-relaxed whitespace-pre-line text-ink">
        {testimonial.quote}
      </blockquote>
      {testimonial.outcome && <p className="mt-3 font-mono text-xs text-quant">Outcome: {testimonial.outcome}</p>}

      <footer className="mt-5 flex flex-wrap items-center gap-2">
        {ACTIONS[testimonial.status].map((action) => (
          <form key={action.to} action={setTestimonialStatus}>
            <input type="hidden" name="id" value={testimonial.id} />
            <input type="hidden" name="status" value={action.to} />
            <PendingButton pendingLabel="Saving…" className={`h-9 rounded-md px-4 text-sm font-medium transition-colors ${action.tone}`}>
              {action.label}
            </PendingButton>
          </form>
        ))}
        <form action={deleteTestimonial} className="ml-auto">
          <input type="hidden" name="id" value={testimonial.id} />
          <PendingButton pendingLabel="Deleting…" className="h-9 rounded-md px-3 text-sm text-muted/70 transition-colors hover:text-red-400">
            Delete
          </PendingButton>
        </form>
      </footer>
    </article>
  );
}
