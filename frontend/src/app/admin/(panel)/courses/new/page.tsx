import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { CourseForm } from "@/domains/courses/components/CourseForm";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  await AdminAuth.require();
  return (
    <div className="max-w-4xl">
      <Link href="/admin/courses" className="text-sm text-muted hover:text-ink">
        ← Courses
      </Link>
      <h1 className="mt-3 text-3xl font-normal tracking-tight italic">New course</h1>
      <p className="mt-2 mb-8 text-sm text-muted">New courses start as drafts unless you tick Published.</p>
      <CourseForm />
    </div>
  );
}
