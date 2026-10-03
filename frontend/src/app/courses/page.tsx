import type { Metadata } from "next";
import Link from "next/link";

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
          Pick a course to see its full curriculum, schedule and fees.
        </p>
      </section>

      <section aria-label="Course list" className="border-t border-line">
        <div className="page-container py-14 lg:py-20">
          {courses.length === 0 ? (
            <p className="text-muted">New courses are being scheduled. Book a free demo to hear about them first.</p>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2">
              {courses.map((course) => (
                <li key={course.id}>
                  <Link
                    href={`/courses/${course.slug}`}
                    className="group flex h-full flex-col rounded-xl border border-line bg-surface p-6 transition-colors hover:border-quant/60"
                  >
                    <p className="font-mono text-xs tracking-[0.16em] text-quant uppercase">{course.category}</p>
                    <h2 className="mt-3 text-2xl font-bold group-hover:text-quant">{course.title}</h2>
                    <p className="mt-3 flex-1 leading-relaxed text-muted">{course.summary}</p>
                    <p className="mt-6 font-mono text-xs tracking-[0.12em] text-muted uppercase">
                      {CourseFormat.startDate(course.startDate)} · {course.duration} · {CourseFormat.price(course)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
