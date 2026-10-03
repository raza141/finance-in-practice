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
      <section className="page-container pt-14 pb-12 lg:pt-20">
        <p className="font-mono text-xs tracking-[0.22em] text-quant uppercase">Courses</p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-black sm:text-5xl">
          Theory you can defend, models you can run
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          CFA® and FRM® exam prep, university mentorship and hands-on quantitative finance, taught by a practitioner who builds the models.
        </p>
      </section>

      <section id="curriculum" aria-labelledby="curriculum-heading" className="border-t border-line">
        <div className="page-container py-14 lg:py-20">
          <SectionHeading
            id="curriculum-heading"
            eyebrow="Courses & services"
            title="From exam technique to production code"
            lede="Exam preparation, university mentorship and hands-on quantitative engineering, under one roof."
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

      {courses.length > 0 && (
        <section aria-labelledby="scheduled-heading" className="border-t border-line">
          <div className="page-container py-14 lg:py-20">
            <SectionHeading
              id="scheduled-heading"
              eyebrow="Scheduled"
              title="Upcoming courses"
              lede="Fixed-start courses with a full curriculum, schedule and fees."
            />
            <ul className="mt-12 grid gap-6 md:grid-cols-2">
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
                      {CourseFormat.startDate(course.startDate)} · {course.duration} · {CourseFormat.price(course)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
