import { CosmicScrollStage } from "@/core/components/3d/CosmicScrollStage";
import { TestimonialStop } from "@/domains/testimonials/components/TestimonialStop";
import { TestimonialCatalog } from "@/domains/testimonials/services/TestimonialCatalog";

/** Landing-page testimonials, using the same cosmic scroll journey as /about. */
export function TestimonialsSection() {
  const testimonials = new TestimonialCatalog().all();

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
    </CosmicScrollStage>
  );
}
