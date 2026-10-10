import type { Metadata } from "next";
import Script from "next/script";

import { BookButton } from "@/core/components/ui/BookButton";
import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { FreeResourceBlock } from "@/domains/resources/components/FreeResourceBlock";
import { ResourceCatalog } from "@/domains/resources/services/ResourceCatalog";

export const metadata: Metadata = {
  title: "Free CFA® Resources & Study Templates",
  description:
    "Free CFA® Level I Exam Map: topic weights, exam format and a 12-week study route. Plus Notion study templates and cheat sheets.",
  alternates: { canonical: "/resources" },
};

/** Free downloads (email in, PDF out) and paid templates (Lemon Squeezy overlay checkout). */
export default function ResourcesPage() {
  const paid = ResourceCatalog.PAID;
  return (
    <>
      <section className="page-container pt-14 pb-10 lg:pt-20">
        <p className="font-mono text-xs tracking-[0.22em] text-quant uppercase">Resources</p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-black sm:text-5xl">Study smarter for CFA® and FRM®</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink/80">Free guides to get you started. Templates and cheat sheets to keep you on track.</p>
      </section>

      <section aria-label="Free downloads" className="page-container grid gap-6 pb-16">
        {ResourceCatalog.FREE.map((resource) => (
          <FreeResourceBlock key={resource.id} resource={resource} source="resources" />
        ))}
      </section>

      {paid.length > 0 && (
        <section aria-labelledby="templates-heading" className="border-t border-line">
          {/* Lemon Squeezy opens checkout in an overlay for links with this class; it handles tax, receipts and delivery. */}
          <Script src="https://app.lemonsqueezy.com/js/lemon.js" strategy="lazyOnload" />
          <div className="page-container py-16 lg:py-20">
            <SectionHeading id="templates-heading" eyebrow="Templates & cheat sheets" title="Templates built for real exam prep" />
            <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paid.map((product) => (
                <li key={product.id} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
                  <p className="font-mono text-xs tracking-[0.18em] text-quant uppercase">{product.format}</p>
                  <h3 className="mt-3 text-xl font-bold">{product.title}</h3>
                  <p className="mt-2 flex-1 text-muted">{product.blurb}</p>
                  <div className="mt-6 flex items-center justify-between gap-4">
                    <span className="tabular-data text-lg font-semibold text-ink">{product.price}</span>
                    <a
                      href={`${product.checkoutUrl}${product.checkoutUrl.includes("?") ? "&" : "?"}embed=1`}
                      className="lemonsqueezy-button inline-flex h-10 items-center rounded-md bg-gold px-4 font-mono text-sm font-semibold text-canvas hover:bg-gold-bright"
                    >
                      Buy
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="border-t border-line">
        <div className="page-container flex flex-col items-start gap-5 py-14 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl font-serif text-2xl">Want the plan built around your exam date?</p>
          <BookButton label="Book free diagnostic session" size="lg" />
        </div>
      </section>
    </>
  );
}
