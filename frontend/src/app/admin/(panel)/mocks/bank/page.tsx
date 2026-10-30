import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, PRIMARY_ACTION } from "@/domains/admin/components/PageHeader";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { Inline } from "@/domains/journal/components/RichText";
import { deleteBankQuestion, updateBankQuestions } from "@/domains/mocks/actions/mocks";
import { BankUploadForm, MockQuestionForm } from "@/domains/mocks/components/MockAdminForms";
import { QuestionPreview } from "@/domains/mocks/components/QuestionPreview";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockContract } from "@/domains/mocks/services/MockContract";
import { MockExhibits } from "@/domains/mocks/services/MockExhibits";

export const metadata: Metadata = { title: "Question bank" };

const FILTER = "h-9 rounded-md border border-line bg-canvas/70 px-2 text-sm text-ink";
const BULK = "h-9 rounded-md border border-line px-3 text-sm hover:border-quant/50";

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** Every question, however it arrived: upload, browse, edit and retire here. Mocks and practice sets pick from it on their own pages. */
export default async function QuestionBankPage({ searchParams }: PageProps<"/admin/mocks/bank">) {
  await AdminAuth.require();
  const repo = MockRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code>.
      </p>
    );
  }
  const params = await searchParams;
  const [topicKey, chapterKey, usage, status, edit, copy] = (["topic", "chapter", "usage", "status", "edit", "copy"] as const).map((k) => one(params[k]));
  // ponytail: every question's preview is rendered into the page; past a few thousand, load a topic's list on open.
  const [pool, topics, chapters] = await Promise.all([repo.pool(), repo.topicNames(), repo.chapterNames()]);

  const shown = pool.filter(
    (q) =>
      q.retired === (status === "retired") &&
      (!topicKey || q.topic.trim().toLowerCase() === topicKey.toLowerCase()) &&
      (!chapterKey || q.chapter.trim().toLowerCase() === chapterKey.toLowerCase()) &&
      (!usage || q.usage === usage),
  );
  const groups = new Map<string, typeof shown>();
  for (const q of shown) {
    const key = q.topic.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  const editing = pool.find((q) => q.id === edit);
  const copying = pool.find((q) => q.id === copy);
  const editable = editing && !editing.locked;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Question bank"
        description="Every question lives here. Upload and edit them on this page; mocks and practice sets pick from the bank on their own pages."
        actions={
          <Link href="/admin/mocks/bank?edit=new#editor" className={PRIMARY_ACTION}>
            Add one question
          </Link>
        }
      />
      {one(params.notice) === "used" && (
        <p role="alert" className="mt-4 text-sm text-gold">
          That question is used in a mock or practice set. Remove it there first, or retire it.
        </p>
      )}

      {(edit === "new" || editable || copying) && (
        <section id="editor" aria-label="Question editor" className="mt-6 scroll-mt-6 rounded-lg border border-quant/40 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">{copying ? "New question from a copy" : editable ? "Edit question" : "Add a question"}</h2>
            <Link href="/admin/mocks/bank" className="text-sm text-muted hover:text-ink">
              Cancel
            </Link>
          </div>
          <MockQuestionForm key={edit + copy} question={copying ?? editing} copying={!!copying} topics={topics} chapters={chapters} />
          {editable && (
            <form action={deleteBankQuestion} className="mt-4">
              <input type="hidden" name="questionId" value={editing.id} />
              <PendingButton pendingLabel="Deleting…" className="text-sm text-red-300 hover:underline">
                Delete this question
              </PendingButton>
            </form>
          )}
        </section>
      )}

      <details open={pool.length === 0} className="mt-6 rounded-lg border border-line p-5">
        <summary className="cursor-pointer text-lg">Upload a sheet</summary>
        <div className="mt-4">
          <BankUploadForm />
        </div>
      </details>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-line p-4">
        <label className="grid gap-1 text-xs text-muted">
          Topic
          <select name="topic" defaultValue={topicKey} className={FILTER}>
            <option value="">All</option>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">
          Chapter
          <select name="chapter" defaultValue={chapterKey} className={FILTER}>
            <option value="">All</option>
            {chapters.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">
          Use
          <select name="usage" defaultValue={usage} className={FILTER}>
            <option value="">All</option>
            {Object.entries(MockContract.USAGES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">
          Status
          <select name="status" defaultValue={status} className={FILTER}>
            <option value="">Active</option>
            <option value="retired">Retired</option>
          </select>
        </label>
        <button type="submit" className={BULK}>
          Show
        </button>
      </form>

      {shown.length === 0 ? (
        <p className="mt-6 text-muted">{pool.length === 0 ? "The bank is empty: upload a sheet above." : "No questions match."}</p>
      ) : (
        <form action={updateBankQuestions} className="mt-6 grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Ticked questions:</span>
            {Object.entries(MockContract.USAGES).map(([value, label]) => (
              <button key={value} type="submit" name="op" value={value} className={BULK}>
                {label}
              </button>
            ))}
            <button type="submit" name="op" value={status === "retired" ? "restore" : "retire"} className={BULK}>
              {status === "retired" ? "Restore" : "Retire"}
            </button>
          </div>
          {[...groups.values()].map((questions) => (
            <section key={questions[0].id} className="rounded-lg border border-line">
              <h2 className="border-b border-line px-4 py-3 font-medium">
                {questions[0].topic.trim()} <span className="font-mono text-xs text-muted">{questions.length}</span>
              </h2>
              <ul className="divide-y divide-line">
                {questions.map((q) => (
                  <li key={q.id} className="grid gap-1 px-4 py-3 text-sm">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" name="q" value={q.id} aria-label="Select question" className="mt-1" />
                      <details className="min-w-0 flex-1">
                        <summary className="line-clamp-2 cursor-pointer">
                          <Inline text={MockExhibits.parse(q.question).find((p) => p.kind === "text")?.text ?? "(exhibit)"} />
                        </summary>
                        <div className="mt-3">
                          <QuestionPreview q={q} />
                        </div>
                      </details>
                      <span className="flex gap-3 text-xs">
                        {q.locked ? (
                          <span title="Students have started an assessment with this question, so it can't change." className="text-muted">
                            Locked
                          </span>
                        ) : (
                          <Link href={`/admin/mocks/bank?edit=${q.id}#editor`} className="text-quant hover:underline">
                            Edit
                          </Link>
                        )}
                        <Link href={`/admin/mocks/bank?copy=${q.id}#editor`} className="text-quant hover:underline">
                          Copy
                        </Link>
                      </span>
                    </div>
                    <p className="pl-7 font-mono text-xs text-muted">
                      {q.chapter && `${q.chapter} · `}
                      {MockContract.USAGES[q.usage]}
                      {q.vignette && " · vignette"} · answer {q.correct}
                      {q.usedIn.length > 0 && ` · in ${q.usedIn.join(", ")}`}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </form>
      )}
    </div>
  );
}
