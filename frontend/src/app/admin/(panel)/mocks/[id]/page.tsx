import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/domains/admin/components/PageHeader";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { Inline } from "@/domains/journal/components/RichText";
import { QuestionPreview } from "@/domains/mocks/components/QuestionPreview";
import { MockExhibits } from "@/domains/mocks/services/MockExhibits";
import { deleteMock, deleteMockQuestion, setMockPublished } from "@/domains/mocks/actions/mocks";
import { MockAccessForm, MockExamForm, MockQuestionForm, MockUploadForm } from "@/domains/mocks/components/MockAdminForms";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockContract } from "@/domains/mocks/services/MockContract";

export const metadata: Metadata = { title: "Edit mock exam" };

export default async function AdminMockPage({ params, searchParams }: PageProps<"/admin/mocks/[id]">) {
  await AdminAuth.require();
  const [{ id }, { notice, edit }] = await Promise.all([params, searchParams]);
  const repo = MockRepository.fromEnv();
  const mock = MockContract.isUuid(id) ? await repo?.byId(id) : null;
  if (!repo || !mock) notFound();
  const [questions, students, granted, topics] = await Promise.all([
    repo.questions(mock.id),
    repo.students(),
    repo.accessClients(mock.id),
    edit && !mock.attempted ? repo.topicNames() : [],
  ]);
  // ?edit=new adds a question, ?edit=<question id> edits that one.
  const editing = mock.attempted ? undefined : edit === "new" ? null : questions.find((q) => q.id === edit);

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
          Students have sat this mock. To delete it, tick the box by &ldquo;Delete this mock&rdquo; (their results go too), or unpublish it to hide it.
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

      <section aria-labelledby="access" className="mt-6 rounded-lg border border-line p-5">
        <h2 id="access" className="text-lg">
          Who can take it
        </h2>
        <p className="mt-1 text-sm text-muted">Students removed later keep their past results, and can finish an attempt they&rsquo;ve already started.</p>
        <div className="mt-4">
          <MockAccessForm mock={mock} students={students} granted={granted} />
        </div>
      </section>

      <section aria-labelledby="sheet" className="mt-6 rounded-lg border border-line p-5">
        <h2 id="sheet" className="text-lg">
          Questions
        </h2>
        <p className="mt-2 text-sm text-muted">
          Columns: Number, Topic, Vignette (optional), Question, Option_A, Option_B, Option_C, Correct_Option (A, B or C), Explanation (optional). A new upload replaces
          every question.
        </p>
        <div className="mt-4">
          <MockUploadForm mockId={mock.id} attempted={mock.attempted} />
        </div>
        {mock.attempted ? (
          <p className="mt-4 text-sm text-muted">Students have started this mock, so single questions can&rsquo;t be edited; upload the corrected sheet above instead.</p>
        ) : (
          <>
            {editing === undefined ? (
              <Link href={`/admin/mocks/${mock.id}?edit=new#editor`} className="mt-6 inline-block text-sm text-quant hover:underline">
                + Add one question here (easier for tables and term structures)
              </Link>
            ) : (
              <div id="editor" className="mt-6 scroll-mt-6 rounded-lg border border-quant/40 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{editing ? `Edit question ${editing.number}` : "Add a question"}</h3>
                  <Link href={`/admin/mocks/${mock.id}`} className="text-sm text-muted hover:text-ink">
                    Cancel
                  </Link>
                </div>
                <MockQuestionForm
                  key={editing?.id ?? "new"}
                  mockId={mock.id}
                  question={editing ?? undefined}
                  nextNumber={Math.max(0, ...questions.map((q) => q.number)) + 1}
                  topics={topics}
                />
                {editing && (
                  <form action={deleteMockQuestion} className="mt-4">
                    <input type="hidden" name="id" value={mock.id} />
                    <input type="hidden" name="questionId" value={editing.id} />
                    <PendingButton pendingLabel="Deleting…" className="text-sm text-red-300 hover:underline">
                      Delete this question
                    </PendingButton>
                  </form>
                )}
              </div>
            )}
          </>
        )}
        {questions.length > 0 && (
          <ol className="mt-6 divide-y divide-line rounded-lg border border-line text-sm">
            {questions.map((q) => (
              <li key={q.id} id={`q${q.number}`} className="grid scroll-mt-6 gap-1 px-4 py-3">
                <p className="flex justify-between gap-4 font-mono text-xs text-muted">
                  <span>
                    {q.number} · {q.topic}
                    {q.vignette && " · vignette"} · answer <span className="text-emerald-300">{q.correct}</span>
                  </span>
                  {!mock.attempted && (
                    <Link href={`/admin/mocks/${mock.id}?edit=${q.id}#editor`} className="text-quant hover:underline">
                      Edit
                    </Link>
                  )}
                </p>
                {/* Opens to the question as students see it, tables and charts included. */}
                <details>
                  <summary className="line-clamp-2 cursor-pointer">
                    <Inline text={MockExhibits.parse(q.question).find((p) => p.kind === "text")?.text ?? "(exhibit)"} />
                  </summary>
                  <div className="mt-3">
                    <QuestionPreview q={q} />
                  </div>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>

      <form action={deleteMock} className="mt-8 grid justify-items-start gap-2">
        <input type="hidden" name="id" value={mock.id} />
        {mock.attempted && (
          <label className="flex items-start gap-2 text-sm text-red-200">
            <input type="checkbox" name="withAttempts" value="1" required className="mt-1" />
            Students have started this mock. Deleting it deletes their attempts and results too. Tick to go ahead.
          </label>
        )}
        <PendingButton pendingLabel="Deleting…" className="text-sm text-red-300 hover:underline">
          Delete this mock
        </PendingButton>
      </form>
    </div>
  );
}
