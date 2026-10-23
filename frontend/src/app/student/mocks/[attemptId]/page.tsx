import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { FinanceBackdrop } from "@/core/components/backdrop/FinanceBackdrop";
import { Logo } from "@/core/components/layout/Logo";
import { Inline, RichText } from "@/domains/journal/components/RichText";
import { MockPlayer } from "@/domains/mocks/components/MockPlayer";
import { MockResults } from "@/domains/mocks/components/MockResults";
import { MockSession } from "@/domains/mocks/server/MockSession";
import { MockContract } from "@/domains/mocks/services/MockContract";
import { MockGrader } from "@/domains/mocks/services/MockGrader";
import type { ActiveQuestion } from "@/domains/mocks/types";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

export const metadata: Metadata = { title: "Mock exam", robots: { index: false, follow: false } };

/** Question text as the player and the results show it: KaTeX rendered here, on the server. */
const rendered = (q: ActiveQuestion) => ({
  id: q.id,
  number: q.number,
  vignette: q.vignette ? <RichText text={q.vignette} /> : null,
  question: <RichText text={q.question} />,
  options: q.options.map((o, i) => <Inline key={i} text={o} />) as [ReactNode, ReactNode, ReactNode],
});

/** One attempt: the CBT player while it's open, the results and revision once it's submitted (or its clock ran out). */
export default async function MockAttemptPage({ params }: PageProps<"/student/mocks/[attemptId]">) {
  const [student, { attemptId }] = await Promise.all([StudentAuth.current(), params]);
  if (!student) redirect("/student");
  if (!MockContract.isUuid(attemptId)) notFound();
  const repo = MockSession.repo();
  const attempt = await MockSession.load(repo, attemptId, student.id);
  if (!attempt) notFound();
  const mock = await repo.byId(attempt.mockId);
  if (!mock) notFound();
  const tag = [MockContract.TYPES[mock.mockType], mock.source].filter(Boolean).join(" · ");

  if (attempt.status === "in_progress") {
    // Only the answer-free SELECT feeds an open attempt: nothing here can carry the answer key to the browser.
    const [questions, responses] = await Promise.all([repo.activeQuestions(attempt.mockId), repo.responses(attempt.id)]);
    return (
      <div className="-mt-20 bg-canvas">
        <MockPlayer
          attemptId={attempt.id}
          studentName={student.name}
          title={mock.title}
          tag={tag}
          remainingMs={MockGrader.remainingMs(attempt.endsAt)}
          questions={questions.map((q) => rendered(MockGrader.active(q)))}
          initial={responses}
        />
      </div>
    );
  }

  const [questions, responses] = await Promise.all([repo.questions(attempt.mockId), repo.responses(attempt.id)]);
  const mine = new Map(responses.map((r) => [r.questionId, r]));
  const seconds = ((attempt.submittedAt ?? attempt.endsAt).getTime() - attempt.startedAt.getTime()) / 1000;
  return (
    <div className="relative -mt-20 min-h-screen overflow-clip">
      <FinanceBackdrop glow={false} className="absolute inset-0 bg-fixed" />
      <header className="sticky top-0 z-30 bg-canvas bg-grid-lines bg-fixed">
        <div className="page-container flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="Finance in Practice website">
            <Logo height={30} priority />
          </Link>
          <Link href="/student" className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
            ← Back to the portal
          </Link>
        </div>
      </header>
      <div className="page-container relative max-w-5xl py-8 lg:py-10">
        <MockResults
          attemptId={attempt.id}
          title={mock.title}
          grade={MockGrader.grade(questions, responses)}
          seconds={seconds}
          questions={questions.map((q) => ({
            ...rendered(q),
            topic: q.topic,
            correct: q.correct,
            explanation: q.explanation ? <RichText text={q.explanation} /> : null,
            selected: mine.get(q.id)?.selected ?? null,
            flagged: mine.get(q.id)?.flagged ?? false,
            notes: mine.get(q.id)?.notes ?? "",
          }))}
        />
      </div>
    </div>
  );
}
