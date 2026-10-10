import Link from "next/link";

import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";

const PRIMARY = [
  {
    title: "CFA®",
    level: "Level I–II",
    outcome: "Every reading taught through worked problems, so formulas stick on exam day.",
    points: ["Personal study plan", "Exam-style drills", "Formula intuition, not rote"],
    /** Opens the first published course in this category; until there is one, the fallback href. */
    category: "CFA",
    href: "/courses#course-pages",
  },
  {
    title: "FRM®",
    level: "Part I",
    outcome: "Risk models and derivatives built from first principles, then drilled on exam questions.",
    points: ["VaR and stress testing", "Exam-style drills", "Every formula worked, then coded"],
    category: "FRM",
    href: "/courses#course-pages",
  },
];


/** Category -> slug of its first published course (by title, so Level I before Level II); empty if the database is unreachable. */
async function liveCourses(): Promise<Map<string, string>> {
  try {
    const courses = ((await CourseRepository.fromEnv()?.active()) ?? []).toSorted((a, b) => a.title.localeCompare(b.title));
    const byCategory = new Map<string, string>();
    for (const course of courses) if (!byCategory.has(course.category)) byCategory.set(course.category, course.slug);
    return byCategory;
  } catch (error) {
    console.error("home: could not load courses", error);
    return new Map();
  }
}

export async function FeaturedCoursesSection() {
  const live = await liveCourses();
  return (
    <section aria-labelledby="featured-heading" data-sequence="reveal" className="page-container py-20 lg:py-24">
      <SectionHeading id="featured-heading" eyebrow="Courses" title="Pick where you want to start" />

      <div data-anim="reveal" className="mt-12 grid gap-4 lg:grid-cols-2">
        {PRIMARY.map((course) => (
          <Link
            key={course.title}
            href={live.has(course.category) ? `/courses/${live.get(course.category)}` : course.href}
            className="group flex flex-col rounded-2xl border border-gold/30 bg-surface p-7 transition-colors hover:border-gold/70 sm:p-9"
          >
            <p className="font-mono text-xs tracking-[0.2em] text-gold uppercase">{course.level}</p>
            <h3 className="mt-4 text-4xl font-black sm:text-5xl">{course.title}</h3>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">{course.outcome}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {course.points.map((point) => (
                <li key={point} className="flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-sm text-ink">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
                  {point}
                </li>
              ))}
            </ul>
            <span className="mt-8 font-semibold group-hover:text-gold">
              See the {course.title} course <span aria-hidden>→</span>
            </span>
          </Link>
        ))}
      </div>

      <p data-anim="reveal" className="mt-6 text-muted">
        Also 1-on-1: university finance, financial modeling, Python automation and more.{" "}
        <Link href="/courses" className="font-semibold text-ink underline decoration-quant/50 underline-offset-4 hover:text-quant">
          See all tracks →
        </Link>
      </p>
    </section>
  );
}
