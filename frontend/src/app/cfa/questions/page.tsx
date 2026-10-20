import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/core/components/seo/JsonLd";
import { StructuredData } from "@/core/seo/StructuredData";
import { QuestionCard } from "@/domains/questions/components/QuestionCard";
import { SubscribeForm } from "@/domains/questions/components/SubscribeForm";
import { QuestionPages } from "@/domains/questions/server/QuestionPages";
import { QuestionTaxonomy } from "@/domains/questions/services/QuestionTaxonomy";
import type { Difficulty, QuestionSummary } from "@/domains/questions/types";

export const metadata: Metadata = {
  title: "CFA Practice Questions with Worked Solutions",
  description: "Original CFA Level I exam-style questions, one a day, each with a step-by-step solution, why the wrong answers are wrong and the common exam trap.",
  alternates: { canonical: "/cfa/questions" },
};

type Filters = { level?: string; topic?: string; difficulty?: string };

/** One filter row: "All" plus each value, as links so a filtered view can be shared. */
function FilterRow({ label, name, values, filters, counts }: { label: string; name: keyof Filters; values: { value: string; label: string; hint?: string }[]; filters: Filters; counts: Record<string, number> }) {
  const href = (value: string | null) => {
    const query = new URLSearchParams(Object.entries({ ...filters, [name]: value ?? undefined }).filter((e): e is [string, string] => Boolean(e[1]))).toString();
    return query ? `/cfa/questions?${query}` : "/cfa/questions";
  };
  const current = filters[name];
  const chip = (active: boolean, empty = false) =>
    `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs transition-colors ${active ? "border-quant bg-quant/15 text-quant" : empty ? "border-line/60 text-muted/50 hover:text-muted" : "border-line text-muted hover:border-quant/50 hover:text-ink"}`;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-24 shrink-0 font-mono text-[11px] tracking-[0.2em] text-muted uppercase">{label}</span>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link href={href(null)} className={chip(!current)} aria-current={!current ? "true" : undefined}>
          All
        </Link>
        {values.map((v) => (
          <Link key={v.value} href={href(v.value)} title={v.hint} className={chip(current === v.value, !counts[v.value])} aria-current={current === v.value ? "true" : undefined}>
            {v.label}
            <span className="font-mono text-[10px] opacity-70">{counts[v.value] ?? 0}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function countBy(questions: QuestionSummary[], key: (q: QuestionSummary) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of questions) counts[key(q)] = (counts[key(q)] ?? 0) + 1;
  return counts;
}

/** Every live question, filtered by level, topic and difficulty, grouped by topic in curriculum order. */
export default async function QuestionLibraryPage({ searchParams }: PageProps<"/cfa/questions">) {
  const repo = await QuestionPages.repo();
  if (!repo) notFound();
  const raw = await searchParams;
  const pick = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const filters: Filters = { level: pick("level"), topic: pick("topic"), difficulty: pick("difficulty") };
  const all = await repo.liveSummaries();

  // Each row counts within the other filters, so a chip's number is what clicking it shows.
  const match = (q: QuestionSummary, skip?: keyof Filters) =>
    (skip === "level" || !filters.level || String(q.level) === filters.level) &&
    (skip === "topic" || !filters.topic || q.topic === filters.topic) &&
    (skip === "difficulty" || !filters.difficulty || q.difficulty === filters.difficulty);
  const shown = all.filter((q) => match(q));
  const filtered = Boolean(filters.level || filters.topic || filters.difficulty);
  const topics = QuestionTaxonomy.TOPICS.map((t) => ({ ...t, questions: shown.filter((q) => q.topic === t.slug) })).filter((t) => t.questions.length > 0);

  return (
    <div className="page-container max-w-6xl pt-10 pb-16 lg:pt-12">
      <JsonLd data={StructuredData.graph([StructuredData.breadcrumbs([{ name: "Question Bank", path: "/cfa/questions" }])])} />
      <p className="font-mono text-xs tracking-[0.22em] text-quant uppercase">Question Bank</p>
      <h1 className="mt-4 text-4xl leading-tight font-black sm:text-5xl">CFA practice questions</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        One exam-style question a day, each with a full worked solution, why the other answers are wrong and the trap examiners set.
      </p>
      <Link
        href="/cfa/question-of-the-day"
        className="mt-6 inline-flex h-12 items-center rounded-md bg-gold px-6 text-[15px] font-semibold text-canvas transition-colors hover:bg-gold-bright"
      >
        Today&rsquo;s question →
      </Link>

      <section aria-label="Filters" className="mt-10 space-y-3 rounded-xl border border-line bg-surface/40 p-4 sm:p-5">
        <FilterRow
          label="Level"
          name="level"
          filters={filters}
          counts={countBy(all.filter((q) => match(q, "level")), (q) => String(q.level))}
          values={QuestionTaxonomy.LEVELS.map((l) => ({ value: String(l), label: QuestionTaxonomy.levelLabel(l) }))}
        />
        <FilterRow
          label="Topic"
          name="topic"
          filters={filters}
          counts={countBy(all.filter((q) => match(q, "topic")), (q) => q.topic)}
          values={QuestionTaxonomy.TOPICS.map((t) => ({ value: t.slug, label: t.name }))}
        />
        <FilterRow
          label="Difficulty"
          name="difficulty"
          filters={filters}
          counts={countBy(all.filter((q) => match(q, "difficulty")), (q) => q.difficulty)}
          values={QuestionTaxonomy.DIFFICULTIES.map((d: Difficulty) => ({ value: d, label: QuestionTaxonomy.difficultyLabel(d), hint: QuestionTaxonomy.difficultyHint(d) }))}
        />
        <p className="pt-1 text-xs text-muted">
          {QuestionTaxonomy.DIFFICULTIES.map((d) => `${QuestionTaxonomy.difficultyLabel(d)}: ${QuestionTaxonomy.difficultyHint(d).toLowerCase()}`).join(" · ")}
        </p>
      </section>

      <p className="mt-6 font-mono text-xs text-muted">
        {shown.length} {shown.length === 1 ? "question" : "questions"}
        {filtered && (
          <>
            {" · "}
            <Link href="/cfa/questions" className="text-quant hover:underline">
              Clear filters
            </Link>
          </>
        )}
      </p>

      {topics.length === 0 ? (
        <p className="mt-12 text-muted">{filtered ? "No questions match these filters yet." : "The first question is on its way."}</p>
      ) : (
        topics.map((t) => (
          <section key={t.slug} aria-labelledby={`topic-${t.slug}`} className="mt-10">
            <h2 id={`topic-${t.slug}`} className="flex items-baseline justify-between gap-4 text-2xl font-bold">
              <Link href={`/cfa/questions/${t.slug}`} className="hover:text-quant">
                {t.name}
              </Link>
              <span className="font-mono text-xs font-normal text-muted">{t.questions.length} questions</span>
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {t.questions.map((q) => (
                <li key={q.slug}>
                  <QuestionCard q={q} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <section aria-labelledby="library-subscribe" className="mt-16 max-w-2xl rounded-xl border border-gold/40 bg-gold/5 p-6">
        <h2 id="library-subscribe" className="text-xl font-bold">
          Get tomorrow&rsquo;s CFA question
        </h2>
        <div className="mt-4">
          <SubscribeForm />
        </div>
      </section>
    </div>
  );
}
