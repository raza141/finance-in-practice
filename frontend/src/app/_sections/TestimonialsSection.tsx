import { unstable_rethrow } from "next/navigation";

import { CosmicScrollStage } from "@/core/components/3d/CosmicScrollStage";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { TestimonialStop } from "@/domains/testimonials/components/TestimonialStop";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";
import type { Testimonial } from "@/domains/testimonials/types";

const SUBMIT_HREF = "/testimonials/submit";

/** Approved testimonials only; an unavailable database hides the section rather than failing the page. */
async function loadApproved(): Promise<Testimonial[]> {
  const repo = TestimonialRepository.fromEnv();
  if (!repo) return [];
  try {
    return await repo.approved();
  } catch (error) {
    // Let Next.js prerender signals through instead of baking in an empty section.
    unstable_rethrow(error);
    console.error("[testimonials] could not load approved testimonials", error);
    return [];
  }
}

/** Landing-page testimonials, using the same cosmic scroll journey as /about. */
export async function TestimonialsSection() {
  const testimonials = await loadApproved();

  if (testimonials.length === 0) {
    return (
      <section
        id="testimonials"
        aria-labelledby="testimonials-heading"
        className="page-container flex flex-col items-center border-t border-line py-24 text-center"
      >
        <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">Testimonials · In their words</p>
        <h2 id="testimonials-heading" className="mt-6 text-4xl font-normal tracking-tight italic sm:text-5xl">
          Studied with us?
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Tell future students what it was like.
        </p>
        <ButtonLink href={SUBMIT_HREF} variant="secondary" size="lg" className="mt-8">
          Share your experience
        </ButtonLink>
      </section>
    );
  }

  return (
    <CosmicScrollStage count={testimonials.length} className="border-t border-line">
      <section
        id="testimonials"
        data-cosmic-section
        aria-labelledby="testimonials-heading"
        className="page-container flex min-h-screen flex-col items-center justify-center py-32 text-center"
      >
        <p data-reveal className="font-mono text-xs tracking-[0.3em] text-quant uppercase">
          Testimonials · In their words
        </p>
        <h2
          data-reveal
          id="testimonials-heading"
          className="mt-6 max-w-4xl text-5xl leading-[1.05] font-normal tracking-tight italic sm:text-7xl"
        >
          What our students say
        </h2>
        <p data-reveal className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Exam candidates, university students and working analysts. Scroll to hear from each.
        </p>
        <p data-reveal className="mt-16 font-mono text-[11px] tracking-[0.35em] text-muted uppercase">
          Scroll ↓
        </p>
      </section>

      {testimonials.map((testimonial, i) => (
        <TestimonialStop key={testimonial.id} testimonial={testimonial} index={i} total={testimonials.length} />
      ))}

      <div className="page-container relative flex justify-center pb-24">
        <ButtonLink href={SUBMIT_HREF} variant="secondary" size="lg">
          Share your experience
        </ButtonLink>
      </div>
    </CosmicScrollStage>
  );
}
