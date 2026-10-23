import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/domains/admin/components/PageHeader";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { Inline } from "@/domains/journal/components/RichText";
import { deleteMock, setMockPublished } from "@/domains/mocks/actions/mocks";
import { MockExamForm, MockUploadForm } from "@/domains/mocks/components/MockAdminForms";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockContract } from "@/domains/mocks/services/MockContract";

export const metadata: Metadata = { title: "Edit mock exam" };

export default async function AdminMockPage({ params, searchParams }: PageProps<"/admin/mocks/[id]">) {
  await AdminAuth.require();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  const repo = MockRepository.fromEnv();
  const mock = MockContract.isUuid(id) ? await repo?.byId(id) : null;
  if (!repo || !mock) notFound();
  const questions = await repo.questions(mock.id);

  return (
    <div className="max-w-5xl">
      <Link href="/admin/mocks" className="text-sm text-quant hover:underline">
        ← Mock exams
      </Link>
      <PageHeader
        title={mock.title}
        description={`${MockContract.TYPES[mock.mockType]} · ${mock.questionCount} questions · ${mock.durationMinutes} min · ${mock.published ? "published" : "draft"}`}
        actions={
          <form action={setMockPublished}>
            <input type="hidden" name="id" value={mock.id} />
            <input type="hidden" name="on" value={mock.published ? "0" : "1"} />
            <PendingButton
              pendingLabel="…"
              className={`h-9 rounded-md px-4 text-sm font-medium ${mock.published ? "border border-line" : "bg-gold text-canvas disabled:opacity-50"}`}
            >
              {mock.published ? "Unpublish" : "Publish to students"}
            </PendingButton>
          </form>
        }
      />
      {notice === "attempted" && (
        <p role="alert" className="mt-4 text-sm text-gold">
          Students have sat this mock, so it stays (with their results). Unpublish it to hide it.
        </p>
      )}
      {!mock.published && mock.questionCount === 0 && <p className="mt-4 text-sm text-muted">Upload the questions before publishing: a mock with none isn&rsquo;t shown.</p>}

      <section aria-labelledby="details" className="mt-8 rounded-lg border border-line p-5">
        <h2 id="details" className="text-lg">
          Details
        </h2>
        <div className="mt-4">
          <MockExamForm mock={mock} />
        </div>
      </section>

      <section aria-labelledby="sheet" className="mt-6 rounded-lg border border-line p-5">
        <h2 id="sheet" className="text-lg">
          Questions
        </h2>
        {mock.attempted ? (
          <p className="mt-2 text-sm text-muted">Students have started this mock, so its questions are fixed. For changes, make a new mock.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Columns: Number, Topic, Vignette (optional), Question, Option_A, Option_B, Option_C, Correct_Option (A, B or C), Explanation (optional). A new upload replaces
              every question.
            </p>
            <div className="mt-4">
              <MockUploadForm mockId={mock.id} />
            </div>
          </>
        )}
        {questions.length > 0 && (
          <ol className="mt-6 divide-y divide-line rounded-lg border border-line text-sm">
            {questions.map((q) => (
              <li key={q.id} className="grid gap-1 px-4 py-3">
                <p className="font-mono text-xs text-muted">
                  {q.number} · {q.topic}
                  {q.vignette && " · vignette"} · answer <span className="text-emerald-300">{q.correct}</span>
                </p>
                <p className="line-clamp-2">
                  <Inline text={q.question} />
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {!mock.attempted && (
        <form action={deleteMock} className="mt-8">
          <input type="hidden" name="id" value={mock.id} />
          <PendingButton pendingLabel="Deleting…" className="text-sm text-red-300 hover:underline">
            Delete this mock
          </PendingButton>
        </form>
      )}
    </div>
  );
}
