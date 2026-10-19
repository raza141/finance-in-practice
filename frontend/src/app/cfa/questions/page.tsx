import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/core/components/seo/JsonLd";
import { StructuredData } from "@/core/seo/StructuredData";
import { QuestionCard } from "@/domains/questions/components/QuestionCard";
import { SubscribeForm } from "@/domains/questions/components/SubscribeForm";
import { QuestionPages } from "@/domains/questions/server/QuestionPages";
import { QuestionTaxonomy } from "@/domains/questions/services/QuestionTaxonomy";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "CFA Practice Questions with Worked Solutions",
  description: "Original CFA Level I exam-style questions, one a day, each with a step-by-step solution, why the wrong answers are wrong and the common exam trap.",
  alternates: { canonical: "/cfa/questions" },
};

/** Every live question, grouped by topic in curriculum order. */
export default async function QuestionLibraryPage() {
  const repo = await QuestionPages.repo();
  if (!repo) notFound();
  const all = await repo.liveSummaries();
  const topics = QuestionTaxonomy.TOPICS.map((t) => ({ ...t, questions: all.filter((q) => q.topic === t.slug) })).filter((t) => t.questions.length > 0);

  return (
    <div className="page-container max-w-5xl pt-10 pb-16 lg:pt-12">
      <JsonLd data={StructuredData.graph([StructuredData.breadcrumbs([{ name: "CFA Questions", path: "/cfa/questions" }])])} />
      <h1 className="text-4xl leading-tight font-black sm:text-5xl">CFA practice questions</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        One exam-style question a day, each with a full worked solution, why the other answers are wrong and the trap examiners set.
      </p>
      <Link
        href="/cfa/question-of-the-day"
        className="mt-6 inline-flex h-12 items-center rounded-md bg-gold px-6 text-[15px] font-semibold text-canvas transition-colors hover:bg-gold-bright"
      >
        Today&rsquo;s question →
      </Link>

      {topics.length === 0 ? (
        <p className="mt-12 text-muted">The first question is on its way.</p>
      ) : (
        topics.map((t) => (
          <section key={t.slug} aria-labelledby={`topic-${t.slug}`} className="mt-12">
            <h2 id={`topic-${t.slug}`} className="flex items-baseline justify-between gap-4 text-2xl font-bold">
              <Link href={`/cfa/questions/${t.slug}`} className="hover:text-quant">
                {t.name}
              </Link>
              <span className="font-mono text-xs font-normal text-muted">{t.questions.length} questions</span>
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {t.questions.slice(0, 6).map((q) => (
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
