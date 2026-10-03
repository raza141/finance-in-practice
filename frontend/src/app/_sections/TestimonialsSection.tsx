import { unstable_rethrow } from "next/navigation";

import { GridBackdrop } from "@/core/components/3d/GridBackdrop";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { OrderBookCard } from "@/domains/testimonials/components/OrderBookCard";
import { TickerTape } from "@/domains/testimonials/components/TickerTape";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";
import type { Testimonial, TickerQuote } from "@/domains/testimonials/types";

/** Fills shown in the book; older ones still count toward the ticker averages. */
const BOOK_DEPTH = 6;

interface OrderBook {
  fills: Testimonial[];
  quotes: TickerQuote[];
}

/** Approved testimonials only; an unavailable database shows an empty book rather than failing the page. */
async function loadOrderBook(): Promise<OrderBook> {
  const repo = TestimonialRepository.fromEnv();
  if (!repo) return { fills: [], quotes: [] };
  try {
    const [fills, quotes] = await Promise.all([repo.approved(), repo.tickerQuotes()]);
    return { fills: fills.slice(0, BOOK_DEPTH), quotes };
  } catch (error) {
    // Let Next.js prerender signals through instead of baking in an empty book.
    unstable_rethrow(error);
    console.error("[testimonials] could not load the order book", error);
    return { fills: [], quotes: [] };
  }
}

/** Landing-page social proof: ticker tape and approved testimonials. Submissions live on /testimonials/submit. */
export async function TestimonialsSection() {
  const { fills, quotes } = await loadOrderBook();
  if (fills.length === 0) return null;

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="relative overflow-hidden border-t border-line"
    >
      <GridBackdrop className="absolute inset-0" />

      <div className="relative">
        <TickerTape quotes={quotes} />

        <div className="page-container py-20 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">Learner feedback desk</p>
              <h2 id="testimonials-heading" className="mt-4 text-4xl leading-tight font-bold sm:text-5xl">
                What our students say
              </h2>
            </div>
            <ButtonLink href="/testimonials/submit" variant="secondary">
              Share your experience
            </ButtonLink>
          </div>

          <ol className="mt-12 grid gap-4 lg:grid-cols-2">
            {fills.map((testimonial, i) => (
              <li key={testimonial.id}>
                <OrderBookCard testimonial={testimonial} index={i} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
