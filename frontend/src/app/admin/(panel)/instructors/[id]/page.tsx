import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { deleteInstructor } from "@/domains/team/actions/instructors";
import { InstructorForm } from "@/domains/team/components/InstructorForm";
import { InstructorRepository } from "@/domains/team/server/InstructorRepository";

export const metadata: Metadata = { title: "Edit instructor" };

export default async function EditInstructorPage({ params }: PageProps<"/admin/instructors/[id]">) {
  await AdminAuth.require();
  const instructor = await InstructorRepository.fromEnv()?.byId((await params).id);
  if (!instructor) notFound();

  return (
    <div className="max-w-4xl">
      <Link href="/admin/instructors" className="text-sm text-muted hover:text-ink">
        ← Instructors
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">{instructor.name}</h1>
        {instructor.isActive && (
          <Link href="/about" target="_blank" className="text-sm text-quant hover:underline">
            View on /about ↗
          </Link>
        )}
      </div>
      <div className="mt-8">
        {/* Keyed by id so navigating between instructors resets the form. */}
        <InstructorForm key={instructor.id} instructor={instructor} />
      </div>

      <details className="mt-12 rounded-lg border border-red-400/30 p-5">
        <summary className="text-sm text-red-300/90">Delete this instructor…</summary>
        <p className="mt-3 text-sm text-muted">This permanently removes the profile. To hide it temporarily, unpublish it instead.</p>
        <form action={deleteInstructor} className="mt-4">
          <input type="hidden" name="id" value={instructor.id} />
          <PendingButton
            pendingLabel="Deleting…"
            className="h-10 rounded-md border border-red-400/50 px-4 text-sm text-red-300 transition-colors hover:bg-red-400/10"
          >
            Delete permanently
          </PendingButton>
        </form>
      </details>
    </div>
  );
}
