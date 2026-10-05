import type { ReactNode } from "react";

import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { OrderBookCard } from "@/domains/testimonials/components/OrderBookCard";
import type { Testimonial } from "@/domains/testimonials/types";

import { CourseFormat } from "../services/CourseFormat";
import type { Course, ModulePriority } from "../types";

const PRIORITY_STYLE: Record<ModulePriority, string> = {
  foundation: "border-line text-muted",
  core: "border-quant/40 text-quant",
  high_priority: "border-gold bg-gold font-semibold text-canvas",
};

/** Cards side by side from tablet width: up to four in one row, so four never wrap as 3 + 1. */
const ROW: Record<number, string> = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" };
const row = (count: number) => ROW[count] ?? "md:grid-cols-3";

const external = (href: string) => (href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {});

/**
 * The public course page body. Shared by /courses/[slug] and the admin live
 * preview, so it stays client-safe: no data fetching, no server-only imports.
 * All wording comes from the course; nothing here is specific to one exam.
 */
export function CourseView({
  course,
  testimonials,
  booking,
}: {
  course: Course;
  testimonials: readonly Testimonial[];
  /** The #book section body: the live booking widget, or a stand-in in the preview. */
  booking: ReactNode;
}) {
  const difference = course.difference ? CourseFormat.splitFirstLine(course.difference) : null;
  const facts = [
    { label: "Format", value: course.duration },
    { label: "Next start", value: CourseFormat.startDate(course.startDate) },
    { label: "Fee", value: CourseFormat.price(course) },
  ];
  const cta = (
    <ButtonLink href={course.bookingUrl} size="lg" {...external(course.bookingUrl)}>
      {course.ctaLabel}
    </ButtonLink>
  );

  return (
    <>
      <section className="page-container grid gap-10 pt-14 pb-14 lg:grid-cols-12 lg:pt-20">
        <div className="lg:col-span-7">
          <p className="font-mono text-xs tracking-[0.22em] text-quant uppercase">{course.eyebrow || course.category}</p>
          <h1 className="mt-4 text-4xl leading-tight font-black sm:text-5xl">
            {course.title}
            {course.tagline && <span className="mt-2 block font-serif text-3xl font-normal text-gold italic sm:text-4xl">{course.tagline}</span>}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{course.summary}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {cta}
            {course.method.length > 0 && (
              <ButtonLink href="#method" variant="ghost" size="lg">
                See the method ↓
              </ButtonLink>
            )}
            {course.brochureUrl && (
              <ButtonLink href={course.brochureUrl} variant="secondary" size="lg" target="_blank" rel="noopener noreferrer" download prefetch={false}>
                Brochure <span className="text-xs opacity-70">PDF</span>
              </ButtonLink>
            )}
          </div>
        </div>
        <div className="grid content-start gap-4 lg:col-span-5">
          {difference && (
            <div className="rounded-xl border border-gold/40 bg-gold/5 p-6">
              <p className="text-xl font-bold">{difference.headline}</p>
              {difference.body && <p className="mt-2 leading-relaxed whitespace-pre-line text-muted">{difference.body}</p>}
            </div>
          )}
          <dl className="divide-y divide-line rounded-xl border border-line bg-surface px-6 py-2">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-baseline justify-between gap-6 py-3">
                <dt className="font-mono text-xs tracking-[0.16em] text-muted uppercase">{fact.label}</dt>
                <dd className="tabular-data text-right font-semibold">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {course.method.length > 0 && (
        <section id="method" aria-labelledby="method-heading" className="scroll-mt-20 border-t border-line">
          <div className="page-container py-14 lg:py-20">
            <SectionHeading
              id="method-heading"
              eyebrow="The Finance in Practice method"
              title={`Every topic goes through ${CourseFormat.count(course.method.length)} ${course.method.length === 1 ? "stage" : "stages"}.`}
            />
            <ol className={`mt-10 grid gap-4 ${row(course.method.length)}`}>
              {course.method.map((step, index) => (
                <li key={index} className="rounded-xl border border-line bg-surface p-6">
                  <span className="font-mono text-sm text-quant tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                  {step.description && <p className="mt-2 leading-relaxed text-muted">{step.description}</p>}
                </li>
              ))}
            </ol>
            {course.modes.length > 0 && (
              <div className="mt-12">
                <h3 className="font-mono text-xs tracking-[0.2em] text-quant uppercase">
                  {CourseFormat.count(course.modes.length)} {course.modes.length === 1 ? "way" : "ways"} to learn
                </h3>
                <ul className={`mt-5 grid gap-4 ${row(course.modes.length)}`}>
                  {course.modes.map((mode, index) => (
                    <li key={index} className="rounded-xl border border-line p-5">
                      <p className="font-bold">{mode.title}</p>
                      {mode.description && <p className="mt-2 leading-relaxed text-muted">{mode.description}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {course.modules.length > 0 && (
        <section id="curriculum" aria-labelledby="curriculum-heading" className="scroll-mt-20 border-t border-line">
          <div className="page-container py-14 lg:py-20">
            <SectionHeading id="curriculum-heading" eyebrow="What we work through" title="Your curriculum, made practical." />
            <ol className="mt-10 divide-y divide-line border-y border-line">
              {course.modules.map((module, index) => (
                <li key={index}>
                  <details open className="group py-5">
                    <summary className="grid cursor-pointer list-none gap-x-6 gap-y-2 sm:grid-cols-[4.5rem_1fr_auto] [&::-webkit-details-marker]:hidden">
                      <span className="font-mono text-sm text-quant tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                      <span>
                        <span className="block text-lg leading-snug font-bold">{module.title}</span>
                        {module.summary && <span className="mt-1 block leading-relaxed text-muted">{module.summary}</span>}
                        {course.weightLabel && module.weight && (
                          <span className="mt-2 block font-mono text-xs tracking-wider text-quant">
                            {course.weightLabel}: <span className="font-semibold text-ink">{module.weight}</span>
                          </span>
                        )}
                      </span>
                      <span className="flex items-start gap-3">
                        <span className={`rounded border px-2 py-0.5 font-mono text-[11px] tracking-wider uppercase ${PRIORITY_STYLE[module.priority]}`}>
                          {CourseFormat.PRIORITIES[module.priority]}
                        </span>
                        <span aria-hidden className="text-muted transition-transform group-open:rotate-45">
                          +
                        </span>
                      </span>
                    </summary>
                    <dl className="mt-4 grid gap-4 sm:ml-[6rem] sm:grid-cols-2">
                      {module.coaching && (
                        <div className="rounded-lg border border-line p-4">
                          <dt className="font-mono text-[11px] tracking-[0.16em] text-quant uppercase">{course.coachingLabel}</dt>
                          <dd className="mt-2 leading-relaxed">{module.coaching}</dd>
                        </div>
                      )}
                      {module.practice && (
                        <div className="rounded-lg border border-line p-4">
                          <dt className="font-mono text-[11px] tracking-[0.16em] text-gold uppercase">{course.practiceLabel}</dt>
                          <dd className="mt-2 leading-relaxed">{module.practice}</dd>
                        </div>
                      )}
                      {module.deliverable && (
                        <div className="sm:col-span-2">
                          <dt className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">You leave with</dt>
                          <dd className="mt-1 leading-relaxed">{module.deliverable}</dd>
                        </div>
                      )}
                    </dl>
                  </details>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {course.options.length > 0 && (
        <section aria-labelledby="options-heading" className="border-t border-line">
          <div className="page-container py-14 lg:py-20">
            <SectionHeading id="options-heading" eyebrow="Ways to work together" title="Choose how you engage." />
            <ul className={`mt-10 grid gap-4 ${row(course.options.length)}`}>
              {course.options.map((option, index) => {
                const href = option.bookingUrl || course.bookingUrl;
                return (
                  <li key={index} className="flex flex-col rounded-xl border border-line bg-surface p-6">
                    <h3 className="text-lg font-bold">{option.title}</h3>
                    {option.fee && <p className="tabular-data mt-2 text-2xl font-semibold text-gold">{option.fee}</p>}
                    {option.description && <p className="mt-3 flex-1 leading-relaxed text-muted">{option.description}</p>}
                    <ButtonLink href={href} variant="secondary" className="mt-6" {...external(href)}>
                      {course.ctaLabel}
                    </ButtonLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section aria-labelledby="proof-heading" className="border-t border-line">
          <div className="page-container py-14 lg:py-20">
            <SectionHeading id="proof-heading" eyebrow="Learner feedback" title="From people who took this course." />
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {testimonials.map((testimonial, index) => (
                <OrderBookCard key={testimonial.id} testimonial={testimonial} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      {course.faqs.length > 0 && (
        <section aria-labelledby="faq-heading" className="border-t border-line">
          <div className="page-container grid gap-10 py-14 lg:grid-cols-12 lg:py-20">
            <div className="lg:col-span-4">
              <SectionHeading id="faq-heading" eyebrow="FAQ" title="Questions, answered." />
            </div>
            <div className="divide-y divide-line border-y border-line lg:col-span-8">
              {course.faqs.map((faq, index) => (
                <details key={index} className="group py-4">
                  <summary className="flex cursor-pointer list-none justify-between gap-6 font-semibold [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span aria-hidden className="text-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed whitespace-pre-line text-muted">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {(course.audience || course.notFor) && (
        <section aria-labelledby="fit-heading" className="border-t border-line">
          <div className="page-container py-14 lg:py-20">
            <div className="rounded-2xl border border-line bg-surface p-8 sm:p-12">
              <h2 id="fit-heading" className="text-3xl font-bold">
                Is this for you?
              </h2>
              {course.audience && <p className="mt-4 max-w-3xl text-lg leading-relaxed">{course.audience}</p>}
              {course.notFor && <p className="mt-3 max-w-3xl leading-relaxed text-muted">{course.notFor}</p>}
              <div className="mt-8">{cta}</div>
            </div>
          </div>
        </section>
      )}

      <section id="book" aria-labelledby="course-book-heading" className="scroll-mt-20 border-t border-line">
        <div className="page-container py-16 lg:py-20">{booking}</div>
      </section>

      {course.disclaimer && (
        <p className="page-container pb-12 text-xs leading-relaxed text-muted/80">{course.disclaimer}</p>
      )}
    </>
  );
}
