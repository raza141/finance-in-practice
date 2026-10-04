import { TestimonialContract } from "../services/TestimonialContract";
import type { Testimonial } from "../types";
import { Sparkline } from "./Sparkline";

const SIDE_STYLE = {
  BUY: "border-quant/50 bg-quant/10 text-quant",
  HOLD: "border-gold/50 bg-gold/10 text-gold",
} as const;

/** One approved testimonial as an order-book fill. Older testimonials without ledger fields render as plain notes. */
export function OrderBookCard({ testimonial, index = 0 }: { testimonial: Testimonial; index?: number }) {
  const { fill } = testimonial;
  const location = [testimonial.city, testimonial.country].filter(Boolean).join(", ");

  return (
    <article className="rounded-lg border border-line bg-surface/80 p-4 backdrop-blur-sm sm:p-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {fill ? (
          <>
            <span className={`rounded border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider ${SIDE_STYLE[fill.side]}`}>
              {fill.side}
            </span>
            <span className="font-mono text-sm font-semibold text-ink" title={TestimonialContract.TICKERS[fill.ticker]}>
              {TestimonialContract.SYMBOLS[fill.ticker]}
            </span>
          </>
        ) : (
          testimonial.program && <span className="font-mono text-xs text-quant">{testimonial.program}</span>
        )}
        <span className="ml-auto min-w-0 text-right text-sm text-muted">
          <span className="block truncate">
            <span className="text-ink">{testimonial.author}</span> · {testimonial.context}
          </span>
          {location && <span className="mt-0.5 block truncate font-mono text-[11px] tracking-wide text-muted/80">{location}</span>}
        </span>
      </header>

      {fill && (
        <div className="tabular-data mt-4 grid grid-cols-[1fr_auto] items-end gap-4 border-y border-line/70 py-3 sm:grid-cols-[auto_auto_1fr_auto]">
          <dl className="contents text-xs">
            <div>
              <dt className="text-[10px] tracking-[0.18em] text-muted uppercase">Score</dt>
              <dd className="mt-1 text-sm text-ink">
                {fill.beforeScore}% → {fill.afterScore}%
              </dd>
            </div>
            <div className="hidden sm:block">
              <dt className="text-[10px] tracking-[0.18em] text-muted uppercase">Conviction</dt>
              <dd className="mt-1 flex items-center gap-2 text-sm text-ink">
                <span aria-hidden className="flex gap-[2px]">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className={`h-3 w-1 rounded-[1px] ${i < fill.conviction ? "bg-quant" : "bg-line"}`} />
                  ))}
                </span>
                {fill.conviction}/10
              </dd>
            </div>
            <div className="col-span-2 justify-self-end sm:col-span-1 sm:justify-self-center">
              <dt className="sr-only">Score path</dt>
              <dd>
                <Sparkline before={fill.beforeScore} after={fill.afterScore} delay={Math.min(index, 6) * 120} />
              </dd>
            </div>
            <div className="row-start-1 text-right sm:row-auto">
              <dt className="text-[10px] tracking-[0.18em] text-muted uppercase">Yield</dt>
              <dd className={`mt-1 text-lg font-semibold ${fill.yieldPercent >= 0 ? "text-quant" : "text-gold"}`}>
                {TestimonialContract.formatYield(fill.yieldPercent)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <blockquote className="mt-4 text-[15px] leading-relaxed whitespace-pre-line text-ink/90">{testimonial.quote}</blockquote>
      {!fill && testimonial.outcome && <p className="mt-3 font-mono text-xs text-quant">{testimonial.outcome}</p>}
    </article>
  );
}
