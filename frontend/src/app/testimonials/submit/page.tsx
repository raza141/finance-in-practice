import type { Metadata } from "next";

import { CosmicBackdrop } from "@/core/components/3d/CosmicBackdrop";
import { TestimonialSubmitForm } from "@/domains/testimonials/components/TestimonialSubmitForm";

export const metadata: Metadata = {
  title: "Share your experience",
  description: "Studied or worked with Finance in Practice? Tell other students what it was like.",
  alternates: { canonical: "/testimonials/submit" },
};

export default function SubmitTestimonialPage() {
  return (
    <section aria-labelledby="submit-heading" className="relative -mt-20 overflow-hidden">
      <CosmicBackdrop className="absolute inset-0" tilt={0.6} zoom={7.5} />

      <div className="page-container relative py-32">
        <div className="max-w-3xl">
          <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">Testimonials · Your words</p>
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

          <div className="mt-12">
            <TestimonialSubmitForm />
          </div>
        </div>
      </div>
    </section>
  );
}
