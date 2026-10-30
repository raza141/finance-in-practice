import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, PRIMARY_ACTION } from "@/domains/admin/components/PageHeader";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { MockExamForm } from "@/domains/mocks/components/MockAdminForms";
import { MockTable } from "@/domains/mocks/components/MockTable";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockContract } from "@/domains/mocks/services/MockContract";

export const metadata: Metadata = { title: "Mock exams" };

/** Timed mock exams for the student portal: each picks its questions from the bank. */
export default async function AdminMocksPage() {
  await AdminAuth.require();
  const repo = MockRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const mocks = (await repo.all()).filter((m) => !MockContract.isPractice(m.mockType));

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Mock exams"
        description="Design a mock from one, several or all books, try it, then publish it."
        actions={
          <Link href="/admin/mocks/design" className={PRIMARY_ACTION}>
            Design a mock
          </Link>
        }
      />

      {mocks.length === 0 ? <p className="mt-8 text-muted">No mocks yet.</p> : <MockTable mocks={mocks} label="Mock" />}

      <section aria-labelledby="new-mock" className="mt-10 rounded-lg border border-line p-5">
        <h2 id="new-mock" className="text-lg">
          New empty mock
        </h2>
        <div className="mt-4">
          <MockExamForm />
        </div>
      </section>
    </div>
  );
}
