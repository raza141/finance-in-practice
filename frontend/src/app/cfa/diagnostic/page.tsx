import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Inline } from "@/domains/journal/components/RichText";
import { ExhibitText } from "@/domains/mocks/components/ExhibitText";
import { DiagnosticQuiz } from "@/domains/questions/components/DiagnosticQuiz";
import { QuestionPages } from "@/domains/questions/server/QuestionPages";
import { QuestionTaxonomy } from "@/domains/questions/services/QuestionTaxonomy";

const LEVEL = 1;
const COUNT = 10;

export const metadata: Metadata = {
  title: "Free CFA® Level I Diagnostic Test: 10 Questions, Score by Topic",
  description: "Ten exam-style CFA® Level I questions, one from each topic. See your score by topic in about 15 minutes, free, no sign-up.",
  alternates: { canonical: "/cfa/diagnostic" },
};

/** The free diagnostic: a fresh draw of live Level I questions on every visit, scored in the browser. */
export default async function DiagnosticPage() {
  await connection(); // a new draw each visit
  const repo = await QuestionPages.repo();
  const questions = (await repo?.diagnosticSet(LEVEL, COUNT).catch(() => [])) ?? [];
  if (questions.length < 3) notFound();
  return (
    <article className="page-container max-w-4xl pt-10 pb-16 lg:pt-12">
      <h1 className="text-3xl leading-tight font-black sm:text-4xl">
        Free CFA<sup className="text-[0.45em]">®</sup> Level I diagnostic
      </h1>
      <div className="mt-8">
        <DiagnosticQuiz
          level={LEVEL}
          items={questions.map((q) => ({
            id: q.id,
            topic: q.topic,
            topicName: QuestionTaxonomy.topic(q.topic)?.name ?? q.topic,
            stem: <ExhibitText text={q.stem} />,
            options: q.options.map((o, i) => <Inline key={i} text={o.text} />),
            correct: q.correct,
            path: QuestionTaxonomy.path(q),
          }))}
        />
      </div>
    </article>
  );
}
