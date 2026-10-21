import type { Metadata } from "next";
import Link from "next/link";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { setInstructorActive } from "@/domains/team/actions/instructors";
import { InstructorRepository } from "@/domains/team/server/InstructorRepository";
import { PageHeader, PRIMARY_ACTION } from "@/domains/admin/components/PageHeader";

export const metadata: Metadata = { title: "Instructors" };

export default async function AdminInstructorsPage() {
  await AdminAuth.require();
  const repo = InstructorRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const instructors = await repo.all();

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Instructors"
        description="Published instructors appear on /about in this order. Changes appear immediately."
        actions={
          <Link href="/admin/instructors/new" className={PRIMARY_ACTION}>
            New instructor
          </Link>
        }
      />

      {instructors.length === 0 ? (
        <p className="mt-10 text-muted">No instructors yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {instructors.map((instructor) => (
            <li key={instructor.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
              <span className="tabular-data w-8 text-sm text-muted">{instructor.sortOrder}</span>
              <div className="min-w-0 flex-1 basis-64">
                <Link href={`/admin/instructors/${instructor.id}`} className="font-semibold text-ink hover:text-quant">
                  {instructor.name}
                </Link>
                <p className="mt-1 text-xs text-muted">{instructor.role}</p>
              </div>
              <span
                className={`w-24 text-center text-[11px] tracking-wider uppercase ${instructor.isActive ? "text-quant" : "text-muted/70"}`}
              >
                {instructor.isActive ? "● Published" : "○ Draft"}
              </span>
              <div className="flex w-48 items-center justify-end gap-1">
                <form action={setInstructorActive}>
                  <input type="hidden" name="id" value={instructor.id} />
                  <input type="hidden" name="active" value={String(!instructor.isActive)} />
                  <PendingButton
                    pendingLabel="Saving…"
                    className={`h-9 rounded-md px-3 text-sm transition-colors ${instructor.isActive ? "text-muted hover:text-ink" : "bg-quant/15 text-quant hover:bg-quant/25"}`}
                  >
                    {instructor.isActive ? "Unpublish" : "Publish"}
                  </PendingButton>
                </form>
                <Link href={`/admin/instructors/${instructor.id}`} className="h-9 rounded-md px-3 text-sm leading-9 text-muted hover:text-ink">
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
