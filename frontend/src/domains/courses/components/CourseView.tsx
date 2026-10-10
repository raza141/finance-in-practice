import type { ReactNode } from "react";

import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { LineIcon } from "@/core/components/ui/LineIcon";
import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { OrderBookCard } from "@/domains/testimonials/components/OrderBookCard";
import type { Testimonial } from "@/domains/testimonials/types";

import { CourseFormat } from "../services/CourseFormat";
import type { Course, ModulePriority } from "../types";

const PRIORITY_STYLE: Record<ModulePriority, string> = {
  foundation: "border-muted/60 bg-muted/15 text-ink",
  core: "border-quant/40 text-quant",
  high_priority: "border-gold bg-gold font-semibold text-canvas",
};

/** Cards side by side from tablet width: up to four in one row, so four never wrap as 3 + 1. */
const ROW: Record<number, string> = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" };
const row = (count: number) => ROW[count] ?? "md:grid-cols-3";

const icon = (path: string) => <LineIcon d={path} />;

/** One per method stage, by position: book (learn), target (solve), tool (apply), loop (revise). */
const STAGE_ICONS = [
  icon("M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 22h14M9 7h7M9 11h5"),
  icon("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"),
  icon("M3 3v18h18M7 15l4-4 3 3 6-6M16 8h4v4"),
  icon("M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"),
];

/** One per way to learn, by position: open book (self-study), presenter at a board (tutor-led), two paths merging (hybrid). */
const MODE_ICONS = [
  icon("M12 6.5C10.2 5.2 7.8 4.5 4 4.5v13c3.8 0 6.2.7 8 2 1.8-1.3 4.2-2 8-2v-13c-3.8 0-6.2.7-8 2Zm0 0v13"),
  icon("M3 4h18v11H3zM8 20l4-5 4 5M7 9h6M7 12h4"),
  icon("M6 3v6a6 6 0 0 0 6 6h0a6 6 0 0 1 6 6M18 3v6a6 6 0 0 1-6 6M3 6l3-3 3 3M15 6l3-3 3 3"),
];

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

  const weights = Boolean(course.weightLabel) && course.modules.some((m) => m.weight);
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
              <ButtonLink href="#method" variant="secondary" size="lg">
                See the method ↓
              </ButtonLink>
            )}
            {course.modules.length > 0 && (
              <ButtonLink href="#curriculum" variant="secondary" size="lg">
                See the course ↓
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
            <div className="rounded-r-lg border-l-4 border-gold bg-gold/5 py-5 pr-6 pl-6">
              <p className="font-serif text-xl font-bold">{difference.headline}</p>
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
                <li
                  key={index}
                  className="group relative flex flex-col rounded-2xl border border-line bg-surface p-6 transition duration-300 hover:-translate-y-1 hover:border-quant/50 hover:shadow-[0_12px_40px_-12px_rgba(34,211,238,0.25)]"
                >
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-quant to-gold opacity-50 transition-opacity group-hover:opacity-100" />
                  {/* Big faded stage number behind the content. */}
                  <span aria-hidden className="pointer-events-none absolute top-3 right-5 font-mono text-6xl font-bold text-quant/10 tabular-nums transition-colors group-hover:text-quant/20">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span aria-hidden className="grid h-12 w-12 place-items-center rounded-xl bg-quant/10 text-quant ring-1 ring-quant/30">
                    {STAGE_ICONS[index % STAGE_ICONS.length]}
                  </span>
                  <p className="mt-5 font-mono text-[11px] tracking-[0.16em] text-muted uppercase">Stage {String(index + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 text-xl font-bold">{step.title}</h3>
                  {step.description && <p className="mt-3 leading-relaxed text-muted">{step.description}</p>}
                  {/* Flow arrow to the next stage, on the desktop row only. */}
                  {index < course.method.length - 1 && (
                    <span aria-hidden className="absolute top-1/2 -right-[13px] z-10 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-line bg-canvas text-xs text-quant md:grid">
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {course.modes.length > 0 && (
              <div className="mt-16">
                <p className="font-mono text-xs tracking-[0.2em] text-quant uppercase">
                  {CourseFormat.count(course.modes.length)} {course.modes.length === 1 ? "way" : "ways"} to learn
                </p>
                <h3 className="mt-3 font-serif text-2xl font-bold sm:text-3xl">Choose how each topic is taught.</h3>
                <p className="mt-2 max-w-2xl text-muted">Pick a mode per topic and switch whenever it suits you.</p>
                <ul className={`mt-8 grid gap-5 ${row(course.modes.length)}`}>
                  {course.modes.map((mode, index) => {
                    const { body, bestFor } = CourseFormat.splitBestFor(mode.description);
                    return (
                      <li
                        key={index}
                        className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 transition duration-300 hover:-translate-y-1 hover:border-quant/50 hover:shadow-[0_12px_40px_-12px_rgba(34,211,238,0.25)]"
                      >
                        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-quant to-gold opacity-50 transition-opacity group-hover:opacity-100" />
                        <div className="flex items-center gap-4">
                          <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-quant/10 text-quant ring-1 ring-quant/30">
                            {MODE_ICONS[index % MODE_ICONS.length]}
                          </span>
                          <div>
                            <p className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">Mode {String(index + 1).padStart(2, "0")}</p>
                            <h4 className="text-xl font-bold">{mode.title}</h4>
                          </div>
                        </div>
                        {body && <p className="mt-5 flex-1 leading-relaxed text-muted">{body}</p>}
                        {bestFor && (
                          <div className="mt-6 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
                            <p className="font-mono text-[11px] tracking-[0.16em] text-gold uppercase">Best for</p>
                            <p className="mt-1 text-sm leading-relaxed text-ink">{bestFor}</p>
                          </div>
                        )}
                      </li>
                    );
                  })}
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
            {/* Priority (and weight) | module | practice: compact rows, the weight label written once as a header. */}
            {weights && (
              <p className="mt-10 font-mono text-[11px] tracking-[0.16em] text-quant uppercase">{course.weightLabel}</p>
            )}
            <ol className={`${weights ? "mt-3" : "mt-10"} divide-y divide-line border-y border-line`}>
              {course.modules.map((module, index) => (
                <li key={index} className="grid gap-x-8 gap-y-3 py-6 md:grid-cols-[9rem_1fr_16rem] lg:grid-cols-[9rem_1fr_20rem]">
                  <div className="flex items-center gap-3 md:flex-col md:items-start">
                    <span className={`rounded-full border px-3 py-1 font-mono text-[11px] tracking-wider whitespace-nowrap uppercase ${PRIORITY_STYLE[module.priority]}`}>
                      {CourseFormat.PRIORITIES[module.priority]}
                    </span>
                    {weights && module.weight && <span className="font-mono text-sm font-semibold text-ink tabular-nums">{module.weight}</span>}
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold">
                      <span className="text-quant tabular-nums">{String(index + 1).padStart(2, "0")}.</span> {module.title}
                    </h3>
                    {module.summary && (
                      <p className="mt-1 leading-relaxed text-muted">
                        <strong className="text-ink">Objective:</strong> {module.summary}
                      </p>
                    )}
                    {module.coaching && (
                      <p className="mt-3 leading-relaxed">
                        <strong className="text-quant">{course.coachingLabel}:</strong> {module.coaching}
                      </p>
                    )}
                    {module.deliverable && (
                      <p className="mt-2 leading-relaxed">
                        <strong className="text-ink">Deliverable:</strong> {module.deliverable}
                      </p>
                    )}
                  </div>
                  {module.practice && (
                    <div>
                      <p className="font-bold text-gold">{course.practiceLabel}</p>
                      <p className="mt-1 leading-relaxed">{module.practice}</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {course.options.length > 0 && (
        <section aria-labelledby="options-heading" className="border-t border-line">
          <div className="page-container py-14 lg:py-20">
            {/* One booking button for the whole section, not one per card. */}
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading id="options-heading" eyebrow="Ways to work together" title="Choose how you engage." />
              {cta}
            </div>
            <ul className={`mt-10 grid gap-4 ${row(course.options.length)}`}>
              {course.options.map((option, index) => (
                <li key={index} className="rounded-xl border border-line bg-surface p-6">
                  <h3 className="text-lg font-bold">{option.title}</h3>
                  {option.fee && <p className="tabular-data mt-2 text-2xl font-semibold text-gold">{option.fee}</p>}
                  {option.description && <p className="mt-3 leading-relaxed text-muted">{option.description}</p>}
                </li>
              ))}
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
