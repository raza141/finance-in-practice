import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { CourseEditor } from "@/domains/courses/components/CourseEditor";
import { CoursePolicy } from "@/domains/courses/services/CoursePolicy";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  const admin = await AdminAuth.require();
  const testimonials = (await TestimonialRepository.fromEnv()?.approved()) ?? [];
  return (
    <div>
      <Link href="/admin/courses" className="text-sm text-muted hover:text-ink">
        ← Courses
      </Link>
      <h1 className="mt-3 text-3xl font-normal tracking-tight italic">New course</h1>
      <p className="mt-2 mb-8 text-sm text-muted">New courses are drafts until published.</p>
      <CourseEditor canPublish={CoursePolicy.canPublish(admin)} testimonials={testimonials} />
    </div>
  );
}
