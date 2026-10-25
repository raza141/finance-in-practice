import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/domains/admin/components/PageHeader";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { Inline } from "@/domains/journal/components/RichText";
import { MockBankForm, MockExamForm, type BankTopic } from "@/domains/mocks/components/MockAdminForms";
import { QuestionPreview } from "@/domains/mocks/components/QuestionPreview";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockContract } from "@/domains/mocks/services/MockContract";
import { MockExhibits } from "@/domains/mocks/services/MockExhibits";

export const metadata: Metadata = { title: "Question bank" };

const BOX = "flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm has-[:checked]:border-quant/70";

/** Every uploaded question by topic: build a draft mock from ticked ones and/or a number per topic. */
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
  const from = [(await searchParams).from ?? []].flat().filter(MockContract.isUuid);
  // ponytail: every question's preview is rendered into the page; past a few thousand, load a topic's list on open.
  const [mocks, pool] = await Promise.all([repo.all(), repo.pool(from)]);
  const sources = mocks.filter((m) => m.questionCount > 0);

  // One group per topic however it was capitalised or spaced, named as first written.
  const groups = new Map<string, BankTopic>();
  for (const q of pool) {
    const key = q.topic.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { topic: q.topic.trim(), questions: [] });
    groups.get(key)!.questions.push({
      id: q.id,
      label: `${q.mockTitle} · Q${q.number}${q.vignette ? " · vignette" : ""} · answer ${q.correct}`,
      summary: <Inline text={MockExhibits.parse(q.question).find((p) => p.kind === "text")?.text ?? "(exhibit)"} />,
      preview: <QuestionPreview q={q} />,
    });
  }

  return (
    <div className="max-w-5xl">
      <Link href="/admin/mocks" className="text-sm text-quant hover:underline">
        ← Mock exams
      </Link>
      <PageHeader
        title="Question bank"
        description="Every question you've uploaded, by topic. Give each topic a number and tick any you want for certain: it builds a draft mock to preview and publish. The source mocks don't change."
      />

      {sources.length === 0 ? (
        <section aria-labelledby="first" className="mt-6 rounded-lg border border-line p-5">
          <h2 id="first" className="text-lg">
            The bank is empty: upload a sheet
          </h2>
          <p className="mt-1 text-sm text-muted">Questions join the bank when they&rsquo;re uploaded to a mock. Create one with its sheet here; it stays a draft until you publish it.</p>
          <div className="mt-4">
            <MockExamForm />
          </div>
        </section>
      ) : (
        <>
          {sources.length > 1 && (
            <form className="mt-6 rounded-lg border border-line p-4">
              <p className="text-[11px] tracking-[0.22em] text-muted uppercase">Only from these mocks (none ticked: all)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sources.map((m) => (
                  <label key={m.id} className={BOX}>
                    <input type="checkbox" name="from" value={m.id} defaultChecked={from.includes(m.id)} />
                    {m.title}
                  </label>
                ))}
              </div>
              <button type="submit" className="mt-3 h-9 rounded-md border border-line px-4 text-sm hover:border-quant/50">
                Show these
              </button>
            </form>
          )}
          <div className="mt-6">
            <MockBankForm key={from.join()} topics={[...groups.values()]} from={from} />
          </div>
          <p className="mt-6 text-sm text-muted">
            More questions? Upload a sheet to a{" "}
            <Link href="/admin/mocks" className="text-quant hover:underline">
              new or draft mock
            </Link>
            ; they join the bank straight away.
          </p>
        </>
      )}
    </div>
  );
}
