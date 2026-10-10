import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

import { GridBackdrop } from "@/core/components/3d/GridBackdrop";
import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { OrderBookCard } from "@/domains/testimonials/components/OrderBookCard";
import { SwipeRail } from "@/domains/testimonials/components/SwipeRail";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";
import type { Testimonial } from "@/domains/testimonials/types";

/** Reviews shown on the home page. */
const SHOWN = 6;

/** Approved testimonials only; an unavailable database shows none rather than failing the page. */
async function loadReviews(): Promise<Testimonial[]> {
  const repo = TestimonialRepository.fromEnv();
  if (!repo) return [];
  try {
    return (await repo.approved()).slice(0, SHOWN);
  } catch (error) {
    // Let Next.js prerender signals through instead of baking in an empty list.
    unstable_rethrow(error);
    console.error("[testimonials] could not load reviews", error);
    return [];
  }
}

/** Landing-page social proof: approved testimonials. Submissions live on /testimonials/submit. */
export async function TestimonialsSection() {
  const fills = await loadReviews();
  // No approved reviews yet: skip the section rather than show an empty proof block.
  if (fills.length === 0) return null;

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      data-sequence="reveal"
      className="relative overflow-hidden border-t border-line"
    >
      <GridBackdrop className="absolute inset-0" />

      <div className="relative">
        <div className="page-container py-20 lg:py-24">
          <SectionHeading id="testimonials-heading" eyebrow="Learner results" title="What learners say" />

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

          <p className="mt-8 text-sm text-muted">
            Studied with us?{" "}
            <Link href="/testimonials/submit" className="font-semibold text-ink underline decoration-quant/50 underline-offset-4 hover:text-quant">
              Share your experience
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
