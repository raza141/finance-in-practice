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
import { deleteMock, moveMockQuestion, removeMockQuestion, setMockPublished } from "@/domains/mocks/actions/mocks";
import { bankTopics } from "@/domains/mocks/components/bankTopics";
import { MockAccessForm, MockBankForm, MockExamForm } from "@/domains/mocks/components/MockAdminForms";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockContract } from "@/domains/mocks/services/MockContract";

export const metadata: Metadata = { title: "Edit mock exam" };

export default async function AdminMockPage({ params, searchParams }: PageProps<"/admin/mocks/[id]">) {
  await AdminAuth.require();
  const [{ id }, { notice, add, chapter: chapterParam }] = await Promise.all([params, searchParams]);
  const repo = MockRepository.fromEnv();
  const mock = MockContract.isUuid(id) ? await repo?.byId(id) : null;
  if (!repo || !mock) notFound();
  const [questions, students, granted, offered] = await Promise.all([
    repo.questions(mock.id),
    repo.students(),
    repo.accessClients(mock.id),
    // ponytail: every available question's preview is rendered into the page; past a few thousand, load a topic's list on open.
    add && !mock.attempted ? repo.pool(mock) : [],
  ]);
  const chapter = typeof chapterParam === "string" ? chapterParam : "";
  const chapters = [...new Set(offered.map((q) => q.chapter.trim()).filter(Boolean))].sort();
  const noun = MockContract.isPractice(mock.mockType) ? "set" : "mock";

  const groups = bankTopics(chapter ? offered.filter((q) => q.chapter.trim().toLowerCase() === chapter.toLowerCase()) : offered);

  return (
    <div className="max-w-5xl">
      <Link href={noun === "set" ? "/admin/mocks/practice" : "/admin/mocks"} className="text-sm text-quant hover:underline">
        ← {noun === "set" ? "Practice sets" : "Mock exams"}
      </Link>
      <PageHeader
        title={mock.title}
        description={`${MockContract.TYPES[mock.mockType]} · ${mock.questionCount} questions · ${mock.durationMinutes} min · ${mock.published ? "published" : "draft"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {mock.questionCount > 0 && (
              // The student's exam screen with these questions; nothing is saved, so the questions stay editable.
              <Link href={`/admin/mocks/${mock.id}/try`} className="inline-flex h-9 items-center rounded-md border border-quant/50 px-4 text-sm font-medium text-quant hover:bg-quant/10">
                Try it as a student
              </Link>
            )}
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
          </div>
        }
      />
      {notice === "attempted" && (
        <p role="alert" className="mt-4 text-sm text-gold">
          Students have sat this. To delete it, tick the box by &ldquo;Delete this&rdquo; (their results go too), or unpublish it to hide it.
        </p>
      )}
      {!mock.published && mock.questionCount === 0 && <p className="mt-4 text-sm text-muted">Add questions from the bank before publishing: it can&rsquo;t be published with none.</p>}
      {!mock.published && mock.questionCount > 0 && (
        <p className="mt-4 text-sm text-muted">Draft: students can&rsquo;t see it yet. Try it as a student, fix anything, then publish.</p>
      )}

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
        {mock.questionCount > 0 && (
          <p className="mt-1 text-sm text-muted">
            At the CFA pace, {mock.questionCount} questions take about {MockContract.minutes(mock.questionCount, mock.mockType)} min; this {noun} is set to {mock.durationMinutes}.
          </p>
        )}
        {mock.attempted ? (
          <p className="mt-2 text-sm text-muted">Students have started this {noun}, so its questions are fixed. For changes, make a new one.</p>
        ) : add ? (
          <div id="add" className="mt-4 scroll-mt-6 rounded-lg border border-quant/40 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">Add from the bank</h3>
              <Link href={`/admin/mocks/${mock.id}`} className="text-sm text-muted hover:text-ink">
                Close
              </Link>
            </div>
            {chapters.length > 0 && (
              <form className="mb-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="add" value="1" />
                <label className="grid gap-1 text-sm text-muted">
                  Chapter
                  <select name="chapter" defaultValue={chapter} className="h-9 rounded-md border border-line bg-canvas/70 px-2 text-ink">
                    <option value="">All chapters</option>
                    {chapters.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="h-9 rounded-md border border-line px-4 text-sm hover:border-quant/50">
                  Show
                </button>
              </form>
            )}
            {groups.length > 0 ? (
              <MockBankForm key={chapter} mockId={mock.id} topics={groups} chapter={chapter} />
            ) : (
              <p className="text-sm text-muted">
                No questions left to add. Only active questions marked for {noun === "set" ? "practice" : "mocks"} appear here;{" "}
                <Link href="/admin/mocks/bank" className="text-quant hover:underline">
                  check the question bank
                </Link>
                .
              </p>
            )}
          </div>
        ) : (
          <Link href={`/admin/mocks/${mock.id}?add=1#add`} className="mt-3 inline-block text-sm text-quant hover:underline">
            + Add from the question bank
          </Link>
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
                    <span className="flex gap-3">
                      {(["up", "down"] as const).map((direction) => (
                        <form key={direction} action={moveMockQuestion}>
                          <input type="hidden" name="id" value={mock.id} />
                          <input type="hidden" name="questionId" value={q.id} />
                          <input type="hidden" name="direction" value={direction} />
                          <button type="submit" aria-label={`Move question ${q.number} ${direction}`} className="text-quant hover:underline">
                            {direction === "up" ? "↑" : "↓"}
                          </button>
                        </form>
                      ))}
                      <Link href={`/admin/mocks/bank?edit=${q.id}#editor`} className="text-quant hover:underline">
                        Edit in bank
                      </Link>
                      <form action={removeMockQuestion}>
                        <input type="hidden" name="id" value={mock.id} />
                        <input type="hidden" name="questionId" value={q.id} />
                        <button type="submit" className="text-red-300 hover:underline">
                          Remove
                        </button>
                      </form>
                    </span>
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
            Students have started this. Deleting it deletes their attempts and results too. The questions stay in the bank. Tick to go ahead.
          </label>
        )}
        <PendingButton pendingLabel="Deleting…" className="text-sm text-red-300 hover:underline">
          Delete this {noun}
        </PendingButton>
      </form>
    </div>
  );
}
