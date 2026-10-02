import type { Metadata } from "next";

import { BookingPanel } from "@/domains/booking/components/BookingPanel";
import { CurriculumCatalog } from "@/domains/education/services/CurriculumCatalog";

export const metadata: Metadata = {
  title: "1-on-1 Sessions & Free Demo",
  description:
    "Book a free 30-minute demo for CFA®, FRM®, university finance or Python automation 1-on-1 sessions.",
  alternates: { canonical: "/consulting" },
};

export default function ConsultingPage() {
  const tracks = new CurriculumCatalog().all().filter((pillar) => pillar.status === "open");

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6 lg:pt-20">
        <p className="font-mono text-xs tracking-[0.22em] text-quant uppercase">1-on-1 Sessions</p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-black sm:text-5xl">
          Personal tuition, built around your exam date or deadline
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          Every engagement starts with a free demo. We diagnose where you are, agree a plan,
          and you decide whether to continue.
        </p>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {tracks.map((track) => (
            <li key={track.id} className="rounded-xl border border-line bg-surface p-5">
              <span className="font-mono text-xs text-quant">{track.index}</span>
              <h2 className="mt-2 text-lg font-bold">{track.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{track.audience}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="book" aria-labelledby="consulting-book-heading" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <BookingPanel headingId="consulting-book-heading" />
        </div>
      </section>
    </>
  );
}
