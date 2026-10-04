import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { InstructorForm } from "@/domains/team/components/InstructorForm";

export const metadata: Metadata = { title: "New instructor" };

export default async function NewInstructorPage() {
  await AdminAuth.require();
  return (
    <div className="max-w-4xl">
      <Link href="/admin/instructors" className="text-sm text-muted hover:text-ink">
        ← Instructors
      </Link>
      <h1 className="mt-3 text-3xl font-normal tracking-tight italic">New instructor</h1>
      <p className="mt-2 mb-8 text-sm text-muted">New instructors start as drafts unless you tick Published.</p>
      <InstructorForm />
    </div>
  );
}
