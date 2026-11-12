import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import { BookButton } from "@/core/components/ui/BookButton";
import { OrderBookCard } from "@/domains/testimonials/components/OrderBookCard";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";

// Approving a testimonial in admin shows here within the hour.
export const revalidate = 3600;

const load = cache(async () => (await TestimonialRepository.fromEnv()?.results().catch(() => null)) ?? []);

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Student Results: CFA®, FRM® and University Finance",
    description: "Practice-score gains and exam results from Finance in Practice students, in their own words. Every result is checked and published with the student's consent.",
    alternates: { canonical: "/results" },
    // An empty wall is a thin page: kept out of search until the first result is approved.
    ...((await load()).length === 0 && { robots: { index: false, follow: true } }),
  };
}

/** The results wall: approved testimonials that carry a result. Students consent on the form; admin approves each one. */
export default async function ResultsPage() {
  const results = await load();
  return (
    <section aria-labelledby="results-heading" className="page-container pt-10 pb-16 lg:pt-12">
      <h1 id="results-heading" className="text-3xl leading-tight font-black sm:text-4xl">
        Student results
      </h1>
      {results.length > 0 ? (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {results.map((t, i) => (
            <li key={t.id} className="grid">
              <OrderBookCard testimonial={t} index={i} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-3xl border border-ink/10 bg-canvas/70 p-6 backdrop-blur sm:p-8">
          <Trophy aria-hidden strokeWidth={1.75} className="size-6 shrink-0 text-quant" />
          <p className="flex-1 text-ink">The first results are on their way.</p>
        </div>
      )}
      <div className="btn-group mt-8">
        <BookButton />
        <Link href="/testimonials/submit" className="inline-flex h-10 items-center px-2 text-sm text-quant underline-offset-4 hover:underline">
          Studied with us? Share your result
        </Link>
      </div>
    </section>
  );
}
