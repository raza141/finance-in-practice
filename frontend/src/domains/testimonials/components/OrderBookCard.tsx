import { TestimonialContract } from "../services/TestimonialContract";
import type { Testimonial } from "../types";
import { Sparkline } from "./Sparkline";

/** One approved testimonial as a plain review: course, learner, score change, quote. Older ones without scores show the outcome line. */
export function OrderBookCard({ testimonial, index = 0 }: { testimonial: Testimonial; index?: number }) {
  const { fill } = testimonial;
  const location = [testimonial.city, testimonial.country].filter(Boolean).join(", ");
  const course = fill ? TestimonialContract.TICKERS[fill.ticker] : testimonial.program;

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface/80 p-5 backdrop-blur-sm sm:p-6">
      {course && <p className="font-mono text-[11px] tracking-[0.16em] text-quant uppercase">{course}</p>}

      {fill && (
        <div className="tabular-data mt-4 flex items-center justify-between gap-4">
          <p>
            <span className="block text-[11px] tracking-[0.16em] text-muted uppercase">Practice score</span>
            <span className="mt-1 block text-2xl font-semibold text-ink">
              {fill.beforeScore}% <span className="text-quant">→ {fill.afterScore}%</span>
            </span>
          </p>
          <Sparkline before={fill.beforeScore} after={fill.afterScore} delay={Math.min(index, 6) * 120} />
        </div>
      )}

      <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed whitespace-pre-line text-ink/90">{testimonial.quote}</blockquote>
      {!fill && testimonial.outcome && <p className="mt-3 font-mono text-xs text-quant">{testimonial.outcome}</p>}

      <footer className="mt-5 border-t border-line/70 pt-4 text-sm">
        <span className="font-semibold text-ink">{testimonial.author}</span>
        <span className="text-muted"> · {testimonial.context}</span>
        {location && <span className="mt-0.5 block text-xs text-muted">{location}</span>}
      </footer>
    </article>
  );
}
