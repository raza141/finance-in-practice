import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { deleteCourse } from "@/domains/courses/actions/courses";
import { CourseEditor } from "@/domains/courses/components/CourseEditor";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { CoursePolicy } from "@/domains/courses/services/CoursePolicy";
import { saveClassroomLink } from "@/domains/students/actions/classroom";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";

export const metadata: Metadata = { title: "Edit course" };

export default async function EditCoursePage({ params, searchParams }: PageProps<"/admin/courses/[id]">) {
  const admin = await AdminAuth.require();
  const { id } = await params;
  const [course, testimonials, classroomUrl, query] = await Promise.all([
    CourseRepository.fromEnv()?.byId(id),
    TestimonialRepository.fromEnv()?.approved(),
    ClassroomRepository.fromEnv()?.linkFor(id),
    searchParams,
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
        <section id="classroom" className="mt-12 max-w-2xl rounded-lg border border-line p-5">
          <h2 className="text-lg">Google Classroom</h2>
          <p className="mt-1 text-sm text-muted">
            Students with this course get a &ldquo;Join Google Classroom&rdquo; button on /student. Never shown on the public course page. In
            Classroom: Settings → Invite link → copy. New batch? Paste the new class&rsquo;s link.
          </p>
          {query.classroom === "saved" && <p className="mt-3 text-sm text-quant">Saved.</p>}
          {query.classroom === "invalid" && <p className="mt-3 text-sm text-gold">Paste a link that starts with https://classroom.google.com/</p>}
          <form action={saveClassroomLink} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="courseId" value={course.id} />
            <input
              name="classroomUrl"
              type="url"
              defaultValue={classroomUrl ?? ""}
              placeholder="https://classroom.google.com/c/…?cjc=…"
              aria-label="Google Classroom invite link"
              className={`${FIELD} mt-0 min-w-72 flex-1`}
            />
            <PendingButton pendingLabel="Saving…" className="h-10 rounded-md border border-line px-4 text-sm text-muted hover:text-ink">
              Save link
            </PendingButton>
          </form>
        </section>
      )}

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
