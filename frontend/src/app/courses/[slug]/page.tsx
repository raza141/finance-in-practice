import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { siteConfig } from "@/core/config/site";
import { BookingPanel } from "@/domains/booking/components/BookingPanel";
import { CourseEnrolCard } from "@/domains/courses/components/CourseEnrolCard";
import { CourseSyllabus } from "@/domains/courses/components/CourseSyllabus";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { CourseFormat } from "@/domains/courses/services/CourseFormat";

// Rendered on first request and cached for an hour (ISR). No database work at
// build time, so builds don't depend on the courses table existing.
export const revalidate = 3600;

export function generateStaticParams(): { slug: string }[] {
  return [];
}

/** Shared by generateMetadata and the page, so each request queries once. */
const loadCourse = cache(async (slug: string) => {
  const repo = CourseRepository.fromEnv();
  return repo ? repo.activeBySlug(slug) : null;
});

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const course = await loadCourse((await params).slug);
  if (!course) return { title: "Course not found", robots: { index: false } };
  return {
    title: course.title,
    description: course.summary,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: { title: course.title, description: course.summary, url: `${siteConfig.url}/courses/${course.slug}` },
  };
}

export default async function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  const course = await loadCourse((await params).slug);
  if (!course) notFound();

  const topics = CourseFormat.topicCount(course.syllabus);

  return (
    <>
      <section className="page-container pt-14 pb-12 lg:pt-20">
        <p className="font-mono text-xs tracking-[0.22em] text-quant uppercase">{course.category}</p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-black sm:text-5xl">{course.title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{course.summary}</p>
      </section>

      <section aria-labelledby="curriculum-heading" className="border-t border-line">
        <div className="page-container grid gap-12 py-14 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 id="curriculum-heading" className="text-2xl font-bold sm:text-3xl">
                Curriculum
              </h2>
              {course.syllabus.length > 0 && (
                <p className="font-mono text-xs tracking-[0.16em] text-muted uppercase">
                  {course.syllabus.length} modules{topics > 0 ? ` · ${topics} topics` : ""}
                </p>
              )}
            </div>
            <div className="mt-8">
              {course.syllabus.length > 0 ? (
                <CourseSyllabus modules={course.syllabus} />
              ) : (
                <p className="text-muted">The detailed curriculum is shared on the call and in the brochure.</p>
              )}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <CourseEnrolCard course={course} />
            </div>
          </div>
        </div>
      </section>

      <section id="book" aria-labelledby="course-book-heading" className="scroll-mt-20 border-t border-line">
        <div className="page-container py-16 lg:py-20">
          <BookingPanel
            headingId="course-book-heading"
            title="Book a free call about this course"
            lede={`A 30-minute 1-on-1 call to check fit, prerequisites and the schedule for ${course.title}.`}
          />
        </div>
      </section>
    </>
  );
}
