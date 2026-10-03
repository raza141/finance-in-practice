import type { Metadata } from "next";

import { GridBackdrop } from "@/core/components/3d/GridBackdrop";
import { OrderTicketForm } from "@/domains/testimonials/components/OrderTicketForm";

export const metadata: Metadata = {
  title: "Share your experience",
  description: "Studied or worked with Finance in Practice? Tell other students what it was like.",
  alternates: { canonical: "/testimonials/submit" },
};

export default function SubmitTestimonialPage() {
  return (
    <section aria-labelledby="submit-heading" className="relative -mt-20 overflow-hidden">
      <GridBackdrop className="absolute inset-0" />

      <div className="page-container relative py-32">
        <div className="max-w-3xl">
          <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">Testimonials · Order ticket</p>
          <h1
            id="submit-heading"
            className="mt-6 text-5xl leading-[1.05] font-normal tracking-tight italic sm:text-6xl"
          >
            Share your experience
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Studied or worked with us? Tell future students what it was like. We review every testimonial
            before it appears on the site.
          </p>

          <div className="mt-12 max-w-xl">
            <OrderTicketForm />
          </div>
        </div>
      </div>
    </section>
  );
}
