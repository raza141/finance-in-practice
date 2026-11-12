import { Check } from "lucide-react";
import Link from "next/link";

import { BookButton } from "@/core/components/ui/BookButton";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { SpotlightCard } from "@/core/components/ui/SpotlightCard";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { CourseFormat } from "@/domains/courses/services/CourseFormat";
import { ExamFacts } from "@/domains/courses/services/ExamFacts";
import type { Course } from "@/domains/courses/types";
import { PackageTable } from "@/domains/packages/services/PackageTable";

/** How tutoring cuts each exam's study load. Topic shares mirror the Exam Map PDFs (scripts/resources/build-exam-maps.mjs). */
const TIME_SAVERS: Partial<Record<NonNullable<Course["testimonialTicker"]>, readonly string[]>> = {
  CFA1: ["Start with the five topics worth 55–70% of the marks", "A diagnostic skips what you already know", "Formulas taught as logic, not re-memorised"],
  CFA2: ["Start with the five topics worth 50–75% of the marks", "Item-set drills: questions first, then the case", "A diagnostic skips what you already know"],
  FRM1: ["Start with the two topics worth 60% of the exam", "Quant learned once, used in both", "A diagnostic skips what you already know"],
};

/** The university card's three lines, in place of an exam's time savers. */
const UNIVERSITY_POINTS = [
  "Corporate finance, valuation, investments and econometrics from first principles",
  "Models built by you in Excel, Python, R, Stata or with Bloomberg data",
  "A free diagnostic maps your syllabus, rubric or dissertation data plan",
] as const;

const TRACKED = new Set<string>(["CFA", "FRM", PackageTable.UNIVERSITY_CATEGORY]);

/** Published exam and university courses, by title (CFA Level I, CFA Level II, FRM Part I, University Finance); empty if the database is unreachable. */
async function examCourses(): Promise<Course[]> {
  try {
    const courses = (await CourseRepository.fromEnv()?.active()) ?? [];
    return courses.filter((c) => TRACKED.has(c.category)).toSorted((a, b) => a.title.localeCompare(b.title));
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
      <SectionHeading id="featured-heading" title="Pick your exam or degree track. We'll get you through it." />

      <ul className="mt-8 grid gap-6 md:grid-cols-2">
        {courses.map((course) => {
          const exam = ExamFacts.for(course.testimonialTicker);
          const study = exam?.facts.find((f) => f.label === "typical study")?.value;
          // Re-evaluated every ISR window (1h), so the countdown moves on by itself.
          const [next] = exam ? ExamFacts.nextWindows(exam, new Date(), 1) : [];
          const university = course.category === PackageTable.UNIVERSITY_CATEGORY;
          const savers = university ? UNIVERSITY_POINTS : (course.testimonialTicker && TIME_SAVERS[course.testimonialTicker]) || [];
          return (
            <SpotlightCard
              key={course.id}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface p-6 transition-colors hover:border-gold/50 lg:p-7"
            >
              <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-quant/10 blur-3xl" />
              <h3 className="relative text-2xl font-black sm:text-3xl">{course.title}</h3>
              {university && (
                <p className="relative mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-quant/30 bg-quant/10 px-3 py-1 text-xs text-ink">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-quant" />
                  <span className="font-semibold text-quant">Any semester</span>
                  Midterms, finals &amp; thesis deadlines
                </p>
              )}
              {next && (
                <p className="relative mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-quant/30 bg-quant/10 px-3 py-1 text-xs text-ink">
                  <span aria-hidden className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-quant/60 motion-reduce:hidden" />
                    <span className="relative h-2 w-2 rounded-full bg-quant" />
                  </span>
                  <span className="font-semibold text-quant">Next exam</span>
                  {next.label} · {ExamFacts.countdown(next, new Date())}
                </p>
              )}

              {savers.length > 0 && (
                <div className="relative mt-5 rounded-2xl border border-line bg-canvas/60 p-4">
                  {(study || university) && (
                    <p className="mb-2.5 text-sm text-muted">
                      <span className="tabular-data text-xl font-bold text-ink">{study ?? "BSc · MSc · MBA"}</span> {study ? "typical self-study" : "modules"}
                    </p>
                  )}
                  <ul className="grid gap-2 text-sm text-ink/90">
                    {savers.map((line) => (
                      <li key={line} className="flex gap-2.5">
                        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-quant" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="relative mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pt-5">
                {course.priceMinor ? (
                  <p className="text-sm text-muted">
                    <span className="text-xl font-bold text-ink tabular-nums">{CourseFormat.price(course)}</span> / hour
                    {university && <> · AED 2,000 / month</>}
                  </p>
                ) : null}
                <div className="btn-group w-full sm:w-auto">
                  <BookButton track={university ? "uni" : course.category === "FRM" ? "frm" : "cfa"} />
                  <ButtonLink href={`/courses/${course.slug}`} variant="secondary">
                    Learn more
                  </ButtonLink>
                </div>
              </div>
            </SpotlightCard>
          );
        })}
      </ul>
      <p className="mt-6 text-muted">
        Also 1-on-1: personal finance, financial modeling, Python automation and more.{" "}
        <Link href="/courses" className="font-semibold text-ink underline decoration-quant/50 underline-offset-4 hover:text-quant">
          See all tracks →
        </Link>
      </p>
    </section>
  );
}
