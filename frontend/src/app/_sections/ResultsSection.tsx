import Link from "next/link";

import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { OrderBookCard } from "@/domains/testimonials/components/OrderBookCard";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";

/** Social proof right before the steps and booking: the newest results. Renders nothing until one is approved. */
export async function ResultsSection() {
  const results = (await TestimonialRepository.fromEnv()?.results(4).catch(() => null)) ?? [];
  if (results.length === 0) return null;
  return (
    <section id="results" aria-labelledby="results-heading" className="border-t border-line">
      <div className="page-container py-12 lg:py-16">
        <SectionHeading id="results-heading" title="Results from our students" />
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {results.map((t, i) => (
            <li key={t.id} className="grid">
              <OrderBookCard testimonial={t} index={i} />
            </li>
          ))}
        </ul>
        <Link href="/results" className="mt-6 inline-block font-semibold text-ink underline decoration-quant/50 underline-offset-4 hover:text-quant">
          All results
        </Link>
      </div>
    </section>
  );
}
