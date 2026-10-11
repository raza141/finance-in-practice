import type { Metadata } from "next";
import Link from "next/link";

import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { BentoCard } from "@/domains/education/components/BentoCard";
import { QuantLabMetrics } from "@/domains/education/components/QuantLabMetrics";
import { ServiceCatalog } from "@/domains/education/services/ServiceCatalog";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { CourseFormat } from "@/domains/courses/services/CourseFormat";
import type { Course } from "@/domains/courses/types";

// ISR like the course pages; admin saves revalidate it immediately.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "CFA® & FRM® Courses in Abu Dhabi & Online",
  description:
    "1-on-1 CFA® Level I, CFA® Level II and FRM® Part I tutoring in Abu Dhabi or online across the UAE, plus applied finance tracks. AED 150/hour, free diagnostic.",
  alternates: { canonical: "/courses" },
};

/** Active courses, or none when the database is unset or unreachable (e.g. at build time). */
async function loadCourses(): Promise<Course[]> {
  try {
    return (await CourseRepository.fromEnv()?.active()) ?? [];
  } catch (error) {
    console.error("courses: could not load courses", error);
    return [];
  }
}

export default async function CoursesPage() {
  const courses = await loadCourses();

  return (
    <>
      <header className="page-container pt-10 lg:pt-12">
        <p className="font-mono text-xs tracking-[0.2em] text-quant uppercase">Learning tracks</p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-bold sm:text-5xl">
          CFA<sup className="text-[0.4em]">®</sup> &amp; FRM<sup className="text-[0.4em]">®</sup> courses, 1-on-1
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          In person in Abu Dhabi or live online across the UAE. Every course starts with a free 30-minute diagnostic.
        </p>
      </header>

      {courses.length > 0 && (
        <section id="course-pages" aria-label="Courses" className="scroll-mt-20">
          <div className="page-container pt-8 pb-12 lg:pb-16">
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <li key={course.id}>
                  <Link
                    href={`/courses/${course.slug}`}
                    className="group flex h-full flex-col rounded-xl border border-line bg-surface p-6 transition-colors hover:border-quant/60"
                  >
                    <p className="font-mono text-xs tracking-[0.16em] text-quant uppercase">{course.category}</p>
                    <h2 className="mt-3 text-2xl font-bold group-hover:text-quant">{course.title}</h2>
                    <p className="mt-3 flex-1 leading-relaxed text-muted">{course.summary}</p>
                    <p className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                      <span className="font-semibold text-ink">{CourseFormat.hourly(course)}</span>
                      <span className="font-mono text-xs text-quant">View course →</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="curriculum" aria-labelledby="curriculum-heading" className="border-t border-line">
        <div className="page-container py-12 lg:py-16">
          <SectionHeading
            id="curriculum-heading"
            eyebrow="Applied finance tracks"
            title="Beyond the exams"
            lede="1-on-1 tracks for coursework, modeling, risk and Python. Pick one, or we'll suggest it after your diagnostic."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-12">
            {new ServiceCatalog().all().map((service) => (
              <BentoCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-line">
        <QuantLabMetrics />
      </div>
    </>
  );
}
