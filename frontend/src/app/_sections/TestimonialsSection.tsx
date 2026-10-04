import { unstable_rethrow } from "next/navigation";

import { GridBackdrop } from "@/core/components/3d/GridBackdrop";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { OrderBookCard } from "@/domains/testimonials/components/OrderBookCard";
import { SwipeRail } from "@/domains/testimonials/components/SwipeRail";
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
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">Learner feedback desk</p>
            <h2 id="testimonials-heading" className="mt-4 text-4xl leading-tight font-bold sm:text-5xl">
              Signals from the Learning Floor
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg xl:text-base 2xl:text-lg">
              The strongest evidence is not a marketing claim. It is the change in a learner’s ability to understand,
              explain and apply financial concepts.
            </p>
          </div>

          {fills.length === 0 ? (
            <p className="mt-12 rounded-lg border border-dashed border-line bg-canvas/60 px-6 py-12 text-center text-muted">
              Reviews appear here once approved. Studied with us? Be the first to share your experience.
            </p>
          ) : (
            <div className="mt-12">
              <SwipeRail label="Learner testimonials">
                {fills.map((testimonial, i) => (
                  <li
                    key={testimonial.id}
                    className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] xl:w-[calc((100%-2rem)/3)] [&>article]:h-full"
                  >
                    <OrderBookCard testimonial={testimonial} index={i} />
                  </li>
                ))}
              </SwipeRail>
            </div>
          )}

          <div className="mt-10 flex flex-col gap-5 border-t border-line/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl font-mono text-xs leading-relaxed tracking-wide text-muted">
              <span className="text-quant uppercase">Feedback policy:</span> Published with learner permission.
              Specificity is valued over exaggeration.
            </p>
            <ButtonLink href="/testimonials/submit" variant="secondary">
              Share your experience
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
