import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { renderQuestion } from "@/domains/mocks/components/AttemptResults";
import { MockPlayer } from "@/domains/mocks/components/MockPlayer";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockContract } from "@/domains/mocks/services/MockContract";
import { MockGrader } from "@/domains/mocks/services/MockGrader";

export const metadata: Metadata = { title: "Try the mock" };

/** The mock in the student's player before (or after) publishing: no attempt is made and nothing is saved, so the questions stay editable. */
export default async function TryMockPage({ params }: PageProps<"/admin/mocks/[id]/try">) {
  await AdminAuth.require();
  const { id } = await params;
  const repo = MockRepository.fromEnv();
  const mock = MockContract.isUuid(id) ? await repo?.byId(id) : null;
  if (!repo || !mock) notFound();
  const questions = await repo.questions(mock.id);
  if (questions.length === 0) notFound();
  // ponytail: a full mock is tried as one sitting (all questions, both sessions' time); its break isn't simulated.
  const all = MockGrader.arrange(questions, null).map((q, i) => ({ ...q, number: i + 1 }));
  return (
    <MockPlayer
      attemptId={`try-${mock.id}`}
      studentName="Preview"
      title={mock.title}
      tag={[MockContract.TYPES[mock.mockType], mock.source].filter(Boolean).join(" · ")}
      remainingMs={mock.durationMinutes * MockContract.sessions(mock) * 60_000}
      questions={all.map((q) => renderQuestion(MockGrader.active(q)))}
      initial={[]}
      answerKey={Object.fromEntries(all.map((q) => [q.id, q.correct]))}
      exitHref={`/admin/mocks/${mock.id}`}
    />
  );
}
