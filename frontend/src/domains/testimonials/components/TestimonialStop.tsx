import type { Testimonial } from "../types";

interface TestimonialStopProps {
  testimonial: Testimonial;
  index: number;
  total: number;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** One full-viewport testimonial "stop" on the landing-page cosmic scroll. */
export function TestimonialStop({ testimonial, index, total }: TestimonialStopProps) {
  const authorId = `${testimonial.id}-author`;
  const counter = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  return (
    <section
      data-cosmic-section
      aria-labelledby={authorId}
      className="page-container flex min-h-screen items-center justify-center py-24"
    >
      <figure className="w-full max-w-3xl rounded-3xl border border-white/10 bg-canvas/45 p-8 text-center backdrop-blur-md sm:p-12">
        <p data-reveal className="font-mono text-xs tracking-[0.3em] text-quant uppercase">
          Student {counter} · {testimonial.program}
        </p>
        <span data-reveal aria-hidden className="mt-6 block font-serif text-7xl leading-none text-gold">
          “
        </span>
        <blockquote
          data-reveal
          className="text-2xl leading-snug font-normal tracking-tight text-ink italic sm:text-4xl"
        >
          {testimonial.quote}
        </blockquote>
        <figcaption data-reveal className="mt-10 flex items-center justify-center gap-4">
          <span
            aria-hidden
            className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_50%_35%,rgb(34_211_238/0.25),transparent_70%)] font-serif text-lg font-bold text-ink italic"
          >
            {initials(testimonial.author)}
          </span>
          <span className="text-left">
            <span id={authorId} className="block font-medium text-ink">
              {testimonial.author}
            </span>
            <span className="block text-sm text-muted">{testimonial.context}</span>
          </span>
        </figcaption>
        {testimonial.outcome && (
          <p
            data-reveal
            className="mx-auto mt-8 w-fit rounded-full border border-quant/30 bg-quant/5 px-4 py-1.5 font-mono text-xs text-quant"
          >
            {testimonial.outcome}
          </p>
        )}
      </figure>
    </section>
  );
}
