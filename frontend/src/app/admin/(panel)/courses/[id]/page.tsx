import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { deleteCourse } from "@/domains/courses/actions/courses";
import { CourseEditor } from "@/domains/courses/components/CourseEditor";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { CoursePolicy } from "@/domains/courses/services/CoursePolicy";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";

export const metadata: Metadata = { title: "Edit course" };

export default async function EditCoursePage({ params }: PageProps<"/admin/courses/[id]">) {
  const admin = await AdminAuth.require();
  const [course, testimonials] = await Promise.all([
    CourseRepository.fromEnv()?.byId((await params).id),
    TestimonialRepository.fromEnv()?.approved(),
  ]);
  if (!course) notFound();

  return (
    <div>
      <Link href="/admin/courses" className="text-sm text-muted hover:text-ink">
        ← Courses
      </Link>
      <div className="mt-3 mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">{course.title}</h1>
        <span className="flex gap-5">
          <Link href={`/admin/course-pdf/${course.id}`} target="_blank" className="text-sm text-gold hover:underline">
            Download PDF ↗
          </Link>
          {course.isActive && (
            <Link href={`/courses/${course.slug}`} target="_blank" className="text-sm text-quant hover:underline">
              View live page ↗
            </Link>
          )}
        </span>
      </div>
      {/* Keyed by id so navigating between courses resets the editor state. */}
      <CourseEditor key={course.id} course={course} canPublish={CoursePolicy.canPublish(admin)} testimonials={testimonials ?? []} />

      {CoursePolicy.canDelete(admin) && (
        <details className="mt-12 max-w-2xl rounded-lg border border-red-400/30 p-5">
          <summary className="text-sm text-red-300/90">Delete this course…</summary>
          <p className="mt-3 text-sm text-muted">
            This permanently removes the course and all its content, and /courses/{course.slug} will return “not found”. To
            hide it temporarily, unpublish it instead.
          </p>
          <form action={deleteCourse} className="mt-4">
            <input type="hidden" name="id" value={course.id} />
            <PendingButton
              pendingLabel="Deleting…"
              className="h-10 rounded-md border border-red-400/50 px-4 text-sm text-red-300 transition-colors hover:bg-red-400/10"
            >
              Delete permanently
            </PendingButton>
          </form>
        </details>
      )}
    </div>
  );
}
