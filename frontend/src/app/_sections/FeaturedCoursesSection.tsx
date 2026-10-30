import Link from "next/link";

import { BookButton } from "@/core/components/ui/BookButton";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { CourseFormat } from "@/domains/courses/services/CourseFormat";
import { ExamFacts } from "@/domains/courses/services/ExamFacts";
import type { Course } from "@/domains/courses/types";

/** How tutoring cuts each exam's study load. Topic shares mirror the Exam Map PDFs (scripts/resources/build-exam-maps.mjs). */
const TIME_SAVERS: Partial<Record<NonNullable<Course["testimonialTicker"]>, readonly string[]>> = {
  CFA1: ["Start with the five topics worth 55–70% of the marks", "A diagnostic skips what you already know", "Formulas taught as logic, not re-memorised"],
  CFA2: ["Start with the five topics worth 50–75% of the marks", "Item-set drills: questions first, then the case", "A diagnostic skips what you already know"],
  FRM1: ["Start with the two topics worth 60% of the exam", "Quant learned once, used in both", "A diagnostic skips what you already know"],
};

/** Published exam courses, by title (CFA Level I, CFA Level II, FRM Part I); empty if the database is unreachable. */
async function examCourses(): Promise<Course[]> {
  try {
    const courses = (await CourseRepository.fromEnv()?.active()) ?? [];
    return courses.filter((c) => c.category === "CFA" || c.category === "FRM").toSorted((a, b) => a.title.localeCompare(b.title));
  } catch (error) {
    console.error("home: could not load courses", error);
    return [];
  }
}

/** One compact tile per exam: the official study load, then how 1-on-1 tutoring cuts it. Exam specs live on the course pages. */
export async function FeaturedCoursesSection() {
  const courses = await examCourses();
  return (
    <section aria-labelledby="featured-heading" className="page-container py-12 lg:py-16">
      <SectionHeading id="featured-heading" title="Pick your exam. We'll get you through it." />

      <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const exam = ExamFacts.for(course.testimonialTicker);
          const study = exam?.facts.find((f) => f.label === "typical study")?.value;
          // Re-evaluated every ISR window (1h), so the countdown moves on by itself.
          const [next] = exam ? ExamFacts.nextWindows(exam, new Date(), 1) : [];
          const savers = (course.testimonialTicker && TIME_SAVERS[course.testimonialTicker]) || [];
          return (
            <li
              key={course.id}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface p-6 transition-colors hover:border-gold/50 sm:p-8"
            >
              <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-quant/10 blur-3xl" />
              <p className="relative font-mono text-xs tracking-[0.2em] text-gold uppercase">{course.category}® · 1-on-1</p>
              <h3 className="relative mt-2 text-3xl font-black sm:text-4xl">{course.title}</h3>
              {/* Two lines held side by side, so a tagline that wraps doesn't push its card's boxes below the others. */}
              {course.tagline && <p className="relative mt-2 font-serif text-lg text-ink/85 italic md:min-h-[2lh]">{course.tagline}</p>}
              {next && (
                <p className="relative mt-4 inline-flex w-fit items-center gap-2 rounded-full border border-quant/30 bg-quant/10 px-3 py-1 text-xs text-ink">
                  <span aria-hidden className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-quant/60 motion-reduce:hidden" />
                    <span className="relative h-2 w-2 rounded-full bg-quant" />
                  </span>
                  <span className="font-semibold text-quant">Next exam</span>
                  {next.label} · {ExamFacts.countdown(next, new Date())}
                </p>
              )}

              {study && (
                <div className="relative mt-6 rounded-2xl border border-line bg-canvas/60 p-5">
                  <p className="text-sm text-muted">
                    <span className="tabular-data text-2xl font-bold text-ink">{study}</span> typical self-study. Make them count:
                  </p>
                  <ul className="mt-3 grid gap-2 text-sm text-ink/90">
                    {savers.map((line) => (
                      <li key={line} className="flex gap-2.5">
                        <span aria-hidden className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gold text-[10px] text-canvas">
                          ✓
                        </span>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="relative mt-auto pt-6">
                {course.priceMinor ? (
                  <p className="text-sm text-muted">
                    <span className="text-xl font-bold text-ink">{CourseFormat.price(course)}</span> / hour · 30-min diagnostic free
                  </p>
                ) : null}
                <div className="btn-group mt-4">
                  <BookButton track={course.category === "FRM" ? "frm" : "cfa"} />
                  <ButtonLink href={`/courses/${course.slug}`} variant="secondary">
                    Learn more →
                  </ButtonLink>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-muted">
        Also 1-on-1: university finance, financial modeling, Python automation and more.{" "}
        <Link href="/courses" className="font-semibold text-ink underline decoration-quant/50 underline-offset-4 hover:text-quant">
          See all tracks →
        </Link>
      </p>
    </section>
  );
}
