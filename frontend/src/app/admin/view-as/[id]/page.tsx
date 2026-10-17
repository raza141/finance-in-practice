import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FinanceBackdrop } from "@/core/components/backdrop/FinanceBackdrop";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { Portal } from "@/domains/students/components/PortalView";
import { StudentRepository } from "@/domains/students/server/StudentRepository";

export const metadata: Metadata = { title: "View as student" };

/** The student's portal exactly as they see it, read-only. Owner only; every view is logged. */
export default async function ViewAsStudentPage({ params }: PageProps<"/admin/view-as/[id]">) {
  const admin = await AdminAuth.requireOwner();
  const { id } = await params;
  const student = await StudentRepository.fromEnv()?.enrolledById(id);
  if (!student) notFound();
  // ponytail: audit trail in the server logs (Vercel), a table if you need history kept past log retention.
  console.info(`admin: ${admin.email} viewed the portal as client ${student.id}`);

  return (
    <div className="relative min-h-screen overflow-clip">
      <FinanceBackdrop glow={false} className="absolute inset-0 bg-fixed" />
      {/* h-16, like the portal's own bar: its tabs stick just below it. */}
      <header className="sticky top-0 z-30 bg-gold/95 text-canvas">
        <div className="page-container flex h-16 items-center justify-between gap-4 text-sm">
          <p>
            <span className="font-mono text-[11px] tracking-wider uppercase">Viewing as</span> <span className="font-semibold">{student.name}</span>
            <span className="hidden sm:inline"> · read-only, nothing you click is sent</span>
          </p>
          <Link href={`/admin/clients/${student.id}`} className="rounded-md border border-canvas/40 px-3 py-1.5 font-medium hover:bg-canvas/10">
            Exit
          </Link>
        </div>
      </header>
      <div className="page-container relative py-8 lg:py-10">
        <Portal student={student} readOnly />
      </div>
    </div>
  );
}
