import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/core/components/seo/JsonLd";
import { StructuredData } from "@/core/seo/StructuredData";
import { QuestionCard } from "@/domains/questions/components/QuestionCard";
import { QuestionPages } from "@/domains/questions/server/QuestionPages";
import { QuestionTaxonomy } from "@/domains/questions/services/QuestionTaxonomy";

export const revalidate = 300;

export function generateStaticParams(): { topic: string }[] {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/cfa/questions/[topic]">): Promise<Metadata> {
  const topic = QuestionTaxonomy.topic((await params).topic);
  if (!topic) return { title: "Topic not found", robots: { index: false } };
  const count = (await (await QuestionPages.repo())?.liveSummaries(topic.slug))?.length ?? 0;
  return {
    title: `CFA ${topic.name} Practice Questions`,
    description: `Original CFA exam-style ${topic.name} questions with step-by-step solutions, why each wrong answer is wrong and the common exam trap.`,
    alternates: { canonical: `/cfa/questions/${topic.slug}` },
    // An empty topic is a thin page; it becomes indexable with its first question.
    ...(count === 0 && { robots: { index: false } }),
  };
}

/** Every live question in one topic, newest first. */
export default async function QuestionTopicPage({ params }: PageProps<"/cfa/questions/[topic]">) {
  const topic = QuestionTaxonomy.topic((await params).topic);
  const repo = await QuestionPages.repo();
  if (!topic || !repo) notFound();
  const questions = await repo.liveSummaries(topic.slug);

  return (
    <div className="page-container max-w-5xl pt-10 pb-16 lg:pt-12">
      <JsonLd
        data={StructuredData.graph([
          StructuredData.breadcrumbs([
            { name: "Question Bank", path: "/cfa/questions" },
            { name: topic.name, path: `/cfa/questions/${topic.slug}` },
          ]),
        ])}
      />
      <Link href="/cfa/questions" className="font-mono text-xs tracking-[0.16em] text-quant uppercase hover:text-ink">
        ← Question Bank
      </Link>
      <h1 className="mt-6 text-4xl leading-tight font-black sm:text-5xl">{topic.name} questions</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">CFA exam-style {topic.name} questions, each with a full worked solution.</p>
      {questions.length === 0 ? (
        <p className="mt-12 text-muted">No {topic.name} questions yet.</p>
      ) : (
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {questions.map((q) => (
            <li key={q.slug}>
              <QuestionCard q={q} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
