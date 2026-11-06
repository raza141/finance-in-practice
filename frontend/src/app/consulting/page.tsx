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

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {tracks.map((track) => (
            <li key={track.id} className="rounded-xl border border-line bg-surface p-5">
              <span className="font-mono text-xs text-quant">{track.index}</span>
              <h2 className="mt-2 text-lg font-bold">{track.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{track.audience}</p>
              {track.fee && <p className="tabular-data mt-3 text-sm font-semibold text-gold">{track.fee}</p>}
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
