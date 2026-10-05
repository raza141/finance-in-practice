import type { Metadata } from "next";
import Link from "next/link";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { setCourseActive } from "@/domains/courses/actions/courses";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { CourseContract } from "@/domains/courses/services/CourseContract";
import { CourseFormat } from "@/domains/courses/services/CourseFormat";
import { CoursePolicy } from "@/domains/courses/services/CoursePolicy";

export const metadata: Metadata = { title: "Courses" };

export default async function AdminCoursesPage() {
  const admin = await AdminAuth.require();
  const canPublish = CoursePolicy.canPublish(admin);
  const repo = CourseRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const courses = await repo.all();

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">Courses</h1>
        <Link
          href="/admin/courses/new"
          className="inline-flex h-10 items-center rounded-md bg-gold px-4 text-sm font-semibold text-canvas transition-colors hover:bg-gold-bright"
        >
          + New course
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Published courses are live at /courses/&lt;slug&gt;; drafts return “not found”. Changes appear on the site immediately.
        {!canPublish && " As an editor you can create and edit drafts; an owner publishes them."}
      </p>

      {courses.length === 0 ? (
        <p className="mt-10 text-muted">No courses yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {courses.map((course) => {
            const notReady = Object.values(CourseContract.publishProblems(course))[0];
            return (
            <li key={course.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
              <div className="min-w-0 flex-1 basis-72">
                <Link href={`/admin/courses/${course.id}`} className="font-semibold text-ink hover:text-quant">
                  {course.title}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {course.category} · {course.modules.length} modules · /courses/{course.slug}
                </p>
              </div>
              <dl className="tabular-data flex gap-x-6 text-sm whitespace-nowrap">
                <dt className="sr-only">Fee</dt>
                <dd className="w-28 text-right">{CourseFormat.price(course)}</dd>
              </dl>
              <span
                className={`w-24 text-center text-[11px] tracking-wider uppercase ${course.isActive ? "text-quant" : "text-muted/70"}`}
              >
                {course.isActive ? "● Published" : "○ Draft"}
              </span>
              <div className="flex w-64 items-center justify-end gap-1">
                {canPublish && !(notReady && !course.isActive) && (
                <form action={setCourseActive}>
                  <input type="hidden" name="id" value={course.id} />
                  <input type="hidden" name="active" value={String(!course.isActive)} />
                  <PendingButton
                    pendingLabel="Saving…"
                    className={`h-9 rounded-md px-3 text-sm transition-colors ${course.isActive ? "text-muted hover:text-ink" : "bg-quant/15 text-quant hover:bg-quant/25"}`}
                  >
                    {course.isActive ? "Unpublish" : "Publish"}
                  </PendingButton>
                </form>
                )}
                {canPublish && notReady && !course.isActive && (
                  <span title={notReady} className="px-3 text-xs text-muted/70">
                    Not ready
                  </span>
                )}
                <Link href={`/admin/courses/${course.id}`} className="h-9 rounded-md px-3 text-sm leading-9 text-muted hover:text-ink">
                  Edit
                </Link>
                {course.isActive && (
                  <Link href={`/courses/${course.slug}`} target="_blank" className="h-9 rounded-md px-3 text-sm leading-9 text-quant hover:underline">
                    View ↗
                  </Link>
                )}
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
