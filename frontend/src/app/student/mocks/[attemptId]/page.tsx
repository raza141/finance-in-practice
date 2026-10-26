import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Logo } from "@/core/components/layout/Logo";
import { MockBreak } from "@/domains/mocks/components/MockBreak";
import { MockPlayer } from "@/domains/mocks/components/MockPlayer";
import { AttemptResults, renderQuestion } from "@/domains/mocks/components/AttemptResults";
import { MockSession } from "@/domains/mocks/server/MockSession";
import { MockContract } from "@/domains/mocks/services/MockContract";
import { MockGrader } from "@/domains/mocks/services/MockGrader";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

export const metadata: Metadata = { title: "Mock exam", robots: { index: false, follow: false } };

/** One attempt: the CBT player while it's open (a full mock: session 1, a break, session 2), the results and revision once it's submitted (or its clock ran out). */
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

  if (MockSession.onBreak(attempt)) {
    return (
      <div className="-mt-20 bg-canvas">
        <MockBreak attemptId={attempt.id} title={mock.title} remainingMs={MockGrader.remainingMs(attempt.breakUntil!)} next={attempt.session} />
      </div>
    );
  }

  if (attempt.status === "in_progress") {
    // Only the answer-free SELECT feeds an open attempt: nothing here can carry the answer key to the browser.
    const [questions, responses, seed] = await Promise.all([repo.activeQuestions(attempt.mockId), repo.responses(attempt.id), repo.seed(attempt)]);
    const sessions = MockContract.sessions(mock);
    // A full mock shows only the session it's in, numbered from 1 like the exam.
    const current = MockGrader.session(MockGrader.arrange(questions, seed), sessions, attempt.session).map((q, i) => ({ ...q, number: i + 1 }));
    const ids = new Set(current.map((q) => q.id));
    return (
      <div className="-mt-20 bg-canvas">
        <MockPlayer
          // A new player for session 2: nothing carries over from session 1's screen.
          key={attempt.session}
          attemptId={attempt.id}
          studentName={student.name}
          title={mock.title}
          tag={tag}
          // Paused: the time that was left at the pause, and the player opens with its clock stopped.
          remainingMs={MockGrader.remainingMs(attempt.endsAt, attempt.pausedAt ?? undefined)}
          paused={attempt.pausedAt !== null}
          questions={current.map((q) => renderQuestion(MockGrader.active(q)))}
          initial={responses.filter((r) => ids.has(r.questionId))}
          session={sessions === 2 ? { index: attempt.session, of: 2 } : null}
        />
      </div>
    );
  }

  return (
    <div className="relative -mt-20 min-h-screen overflow-clip">
      {/* The page's grid, still: no animation behind a mock's results. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-canvas bg-grid-lines" />
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
        <AttemptResults repo={repo} attempt={attempt} title={mock.title} />
      </div>
    </div>
  );
}
