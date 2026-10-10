import { siteConfig } from "@/core/config/site";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { OgImage } from "@/core/seo/OgImage";

export const alt = "Finance in Practice course";
export const size = OgImage.size;
export const contentType = OgImage.contentType;
export const revalidate = 3600;

/** Per-course card (CFA Level I, Level II, …); falls back to the brand card if the course is missing. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await CourseRepository.fromEnv()?.activeBySlug(slug).catch(() => null);
  return OgImage.render({
    eyebrow: course?.eyebrow || "Exam coaching",
    title: course ? `${course.title} Tutoring` : "CFA® & Finance Tutoring",
    subtitle: siteConfig.delivery.short,
  });
}
