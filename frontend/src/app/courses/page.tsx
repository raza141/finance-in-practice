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
  title: "Courses",
  description: "Every Finance in Practice course: curriculum, start date, duration and fees.",
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
      {/* Visually hidden: the page opens on the course cards, but search engines and screen readers still get a title. */}
      <h1 className="sr-only">CFA® and FRM® courses: 1-on-1 in Abu Dhabi and online in Dubai</h1>

      {courses.length > 0 && (
        <section id="course-pages" aria-label="Courses" className="scroll-mt-20">
          <div className="page-container pt-10 pb-14 lg:pt-14 lg:pb-20">
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <li key={course.id}>
                  <Link
                    href={`/courses/${course.slug}`}
                    className="group flex h-full flex-col rounded-xl border border-line bg-surface p-6 transition-colors hover:border-quant/60"
                  >
                    <p className="font-mono text-xs tracking-[0.16em] text-quant uppercase">{course.category}</p>
                    <h3 className="mt-3 text-2xl font-bold group-hover:text-quant">{course.title}</h3>
                    <p className="mt-3 flex-1 leading-relaxed text-muted">{course.summary}</p>
                    <p className="mt-6 font-mono text-xs tracking-[0.12em] text-muted uppercase">
                      {[course.startDate && `Starts ${CourseFormat.startDate(course.startDate)}`, course.duration, CourseFormat.price(course)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section id="curriculum" aria-labelledby="curriculum-heading" className="border-t border-line">
        <div className="page-container py-14 lg:py-20">
          <SectionHeading
            id="curriculum-heading"
            eyebrow="Specialist tracks"
            title="From exam technique to production code"
            lede="Every learner begins with a different mandate: pass an examination, repair a conceptual gap, build technical fluency or translate academic knowledge into practical finance. Select the track aligned with your current objective."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-12">
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
