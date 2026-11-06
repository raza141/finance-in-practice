import type { Metadata } from "next";

import { BookingPanel } from "@/domains/booking/components/BookingPanel";
import { CurriculumCatalog } from "@/domains/education/services/CurriculumCatalog";

export const metadata: Metadata = {
  title: "1-on-1 Sessions & Free Diagnostic",
  description:
    "Book a free 30-minute diagnostic session for CFA®, FRM®, university finance or Python automation 1-on-1 sessions.",
  alternates: { canonical: "/consulting" },
};

export default function ConsultingPage() {
  const tracks = new CurriculumCatalog().all().filter((pillar) => pillar.status === "open");

  return (
    <>
      <section className="page-container pt-10 pb-8 lg:pt-12">
        <h1 className="max-w-3xl text-4xl leading-tight font-black sm:text-5xl">
          Personal tuition, built around your exam date or deadline
        </h1>

        {/* A short price list, not a row of identical cards. */}
        <ul className="mt-10 max-w-4xl divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {tracks.map((track) => (
            <li key={track.id} className="grid gap-x-6 gap-y-1 p-5 sm:grid-cols-[3rem_1fr_auto] sm:items-baseline sm:p-6">
              <span className="font-mono text-sm text-quant">{track.index}</span>
              <div>
                <h2 className="text-lg font-bold">{track.title}</h2>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{track.audience}</p>
              </div>
              {track.fee && <p className="tabular-data text-sm font-semibold text-gold sm:max-w-64 sm:text-right">{track.fee}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section id="book" aria-labelledby="consulting-book-heading" className="border-t border-line">
        <div className="page-container py-12 lg:py-16">
          <BookingPanel headingId="consulting-book-heading" />
        </div>
      </section>
    </>
  );
}
