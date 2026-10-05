import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { JsonLd } from "@/core/components/seo/JsonLd";
import { siteConfig } from "@/core/config/site";
import { StructuredData } from "@/core/seo/StructuredData";
import { BookingPanel } from "@/domains/booking/components/BookingPanel";
import { CourseView } from "@/domains/courses/components/CourseView";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";
import type { Testimonial } from "@/domains/testimonials/types";
import type { Course } from "@/domains/courses/types";

// Rendered on first request and cached for an hour (ISR). No database work at
// build time, so builds don't depend on the courses table existing.
export const revalidate = 3600;

export function generateStaticParams(): { slug: string }[] {
  return [];
}

/** Shared by generateMetadata and the page, so each request queries once. Drafts come back null. */
const loadCourse = cache(async (slug: string) => {
  const repo = CourseRepository.fromEnv();
  return repo ? repo.activeBySlug(slug) : null;
});

/** Approved testimonials for the course's ticker; none if unset or the query fails. */
async function loadTestimonials(course: Course): Promise<Testimonial[]> {
  if (!course.testimonialTicker) return [];
  try {
    return (await TestimonialRepository.fromEnv()?.approvedFor(course.testimonialTicker)) ?? [];
  } catch (error) {
    console.error("courses: could not load testimonials", error);
    return [];
  }
}

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const course = await loadCourse((await params).slug);
  if (!course) return { title: "Course not found", robots: { index: false } };
  const title = course.seoTitle || course.title;
  const description = course.seoDescription || course.summary;
  return {
    title,
    description,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: { title, description, url: `${siteConfig.url}/courses/${course.slug}` },
  };
}

export default async function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  const course = await loadCourse((await params).slug);
  if (!course) notFound();

  return (
    <div data-plain-page className="font-body">
      <JsonLd data={StructuredData.course(course)} />
      <CourseView
        course={course}
        testimonials={await loadTestimonials(course)}
        booking={
          <BookingPanel
            headingId="course-book-heading"
            title={course.ctaLabel}
            lede={`A free 30-minute 1-on-1 call to check fit, your starting point and the plan for ${course.title}.`}
          />
        }
      />
    </div>
  );
}
