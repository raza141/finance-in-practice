import { unstable_rethrow } from "next/navigation";

import { GridBackdrop } from "@/core/components/3d/GridBackdrop";
import { OrderBookCard } from "@/domains/testimonials/components/OrderBookCard";
import { OrderTicketForm } from "@/domains/testimonials/components/OrderTicketForm";
import { TickerTape } from "@/domains/testimonials/components/TickerTape";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";
import type { Testimonial, TickerQuote } from "@/domains/testimonials/types";

/** Fills shown in the book; older ones still count toward the ticker averages. */
const BOOK_DEPTH = 12;

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

/** Landing-page testimonials as a trading screen: ticker tape, order ticket (submit) and order book (approved). */
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
          <div className="max-w-2xl">
            <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">Learner feedback desk</p>
            <h2 id="testimonials-heading" className="mt-4 text-4xl leading-tight font-bold sm:text-5xl">
              What our students say
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Placed an order with our notes, models, or market breakdowns? Log the trade. See your learning
              return compound, then join the order book.
            </p>
          </div>

          <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="lg:sticky lg:top-28">
                <OrderTicketForm />
              </div>
            </div>

            <div className="lg:col-span-7 xl:col-span-8">
              <div className="flex items-baseline justify-between border-b border-line pb-3">
                <h3 className="text-sm font-semibold tracking-[0.2em] uppercase">Testimonial order book</h3>
                <p className="tabular-data text-xs text-muted">
                  {fills.length === 0 ? "No fills yet" : `Latest ${fills.length} ${fills.length === 1 ? "fill" : "fills"}`}
                </p>
              </div>

              {fills.length === 0 ? (
                <div className="mt-6 rounded-lg border border-dashed border-line bg-canvas/60 px-6 py-16 text-center">
                  <p className="tabular-data text-xs tracking-[0.25em] text-muted uppercase">Book is empty</p>
                  <p className="mx-auto mt-3 max-w-sm text-muted">
                    Approved reviews appear here. Use the order ticket to file the first one.
                  </p>
                </div>
              ) : (
                <ol className="mt-6 grid gap-4">
                  {fills.map((testimonial, i) => (
                    <li key={testimonial.id}>
                      <OrderBookCard testimonial={testimonial} index={i} />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
