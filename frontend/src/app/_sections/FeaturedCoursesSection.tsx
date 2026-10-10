import Link from "next/link";

import { BookButton } from "@/core/components/ui/BookButton";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { ExamGlance } from "@/domains/courses/components/ExamGlance";
import { WeightBars } from "@/domains/courses/components/WeightBars";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import type { Course } from "@/domains/courses/types";

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

/** Apple-style product tiles: each course is the hero of its own tile, with numbers and a chart instead of paragraphs. */
export async function FeaturedCoursesSection() {
  const courses = await examCourses();
  return (
    <section aria-labelledby="featured-heading" data-sequence="reveal" className="page-container py-20 lg:py-24">
      <SectionHeading id="featured-heading" eyebrow="Courses" title="Pick your exam. We'll get you through it." />

      <ul data-anim="reveal" className="mt-12 grid gap-4 lg:grid-cols-2">
        {courses.map((course, i) => {
          const lead = i === 0;
          return (
            <li
              key={course.id}
              className={`group relative overflow-hidden rounded-3xl border border-line bg-surface p-7 transition-colors hover:border-gold/50 sm:p-10 ${lead ? "lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-12" : ""}`}
            >
              <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-quant/10 blur-3xl" />
              <div className="relative">
                <p className="font-mono text-xs tracking-[0.2em] text-gold uppercase">{course.category}® · 1-on-1</p>
                <h3 className={`mt-3 font-black ${lead ? "text-4xl sm:text-6xl" : "text-4xl sm:text-5xl"}`}>{course.title}</h3>
                {course.tagline && <p className="mt-3 font-serif text-xl text-ink/85 italic sm:text-2xl">{course.tagline}</p>}
                <div className="mt-8 flex flex-wrap gap-3">
                  <BookButton label="Book free session" size="lg" className="w-full sm:w-auto" />
                  <ButtonLink href={`/courses/${course.slug}`} variant="secondary" size="lg" className="w-full sm:w-auto">
                    Learn more →
                  </ButtonLink>
                </div>
              </div>
              <div className={`relative ${lead ? "mt-10 lg:mt-0" : "mt-10"}`}>
                <ExamGlance ticker={course.testimonialTicker} />
                <WeightBars modules={course.modules} className="mt-8" />
              </div>
            </li>
          );
        })}
      </ul>

      <p data-anim="reveal" className="mt-6 text-muted">
        Also 1-on-1: university finance, financial modeling, Python automation and more.{" "}
        <Link href="/courses" className="font-semibold text-ink underline decoration-quant/50 underline-offset-4 hover:text-quant">
          See all tracks →
        </Link>
      </p>
    </section>
  );
}
