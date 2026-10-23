import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/domains/admin/components/PageHeader";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { MockExamForm, MockPoolForm } from "@/domains/mocks/components/MockAdminForms";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockContract } from "@/domains/mocks/services/MockContract";

export const metadata: Metadata = { title: "Mock exams" };

/** Timed mock exams for the student portal: each is a sheet of questions with a duration. */
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
  const [mocks, topics] = await Promise.all([repo.all(), repo.topics()]);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Mock exams"
        description="Published mocks appear to every signed-in student under Study plan & materials. Create a mock, upload its question sheet, then publish it."
      />

      {mocks.length === 0 ? (
        <p className="mt-8 text-muted">No mocks yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3">Mock</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Questions</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {mocks.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/mocks/${m.id}`} className="font-medium hover:text-quant">
                      {m.title}
                    </Link>
                    {m.source && <span className="block text-xs text-muted">{m.source}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{MockContract.TYPES[m.mockType]}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {m.questionCount} · {m.durationMinutes} min
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <span className={m.published ? "text-emerald-300" : "text-muted"}>{m.published ? "Published" : "Draft"}</span>
                    {m.audience !== "all" && <span className="block text-muted">{m.audience === "course" ? m.courses.join(", ") : "Selected clients"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section aria-labelledby="new-mock" className="mt-10 rounded-lg border border-line p-5">
        <h2 id="new-mock" className="text-lg">
          New mock
        </h2>
        <div className="mt-4">
          <MockExamForm />
        </div>
      </section>

      {topics.length > 0 && (
        <section aria-labelledby="pool" className="mt-6 rounded-lg border border-line p-5">
          <h2 id="pool" className="text-lg">
            Build from the question pool
          </h2>
          <p className="mt-1 text-sm text-muted">
            Random questions copied from the mocks you&rsquo;ve uploaded, by topic. It opens as a draft to preview and publish; the source mocks don&rsquo;t change.
          </p>
          <div className="mt-4">
            <MockPoolForm topics={topics} mocks={mocks.filter((m) => m.questionCount > 0)} />
          </div>
        </section>
      )}
    </div>
  );
}
