import "server-only";

import type { ReactNode } from "react";

import { Inline } from "@/domains/journal/components/RichText";

import type { MockRepository } from "../server/MockRepository";
import { MockContract } from "../services/MockContract";
import { MockGrader } from "../services/MockGrader";
import type { ActiveQuestion, MockAttempt } from "../types";
import { ExhibitText } from "./ExhibitText";
import { MockResults, type RetakeOptions, type ReviewQuestion } from "./MockResults";

/** Question text as the player and the results show it: KaTeX, tables and charts rendered on the server. */
export const renderQuestion = (q: ActiveQuestion) => ({
  id: q.id,
  number: q.number,
  vignette: q.vignette ? <ExhibitText text={q.vignette} /> : null,
  question: <ExhibitText text={q.question} />,
  options: q.options.map((o, i) => <Inline key={i} text={o} />) as [ReactNode, ReactNode, ReactNode],
});

/**
 * A closed attempt's score, topics and every question, in the order that attempt showed them. The student's page and the owner's both use it.
 * The student also gets the two retakes (whole mock, or only the mistakes) while the mock is still open to them.
 */
export async function AttemptResults({ repo, attempt, title, readOnly = false }: { repo: MockRepository; attempt: MockAttempt; title: string; readOnly?: boolean }) {
  const [all, responses, seed, mock, others] = await Promise.all([
    repo.questions(attempt.mockId),
    repo.responses(attempt.id),
    repo.seed(attempt),
    repo.byId(attempt.mockId),
    // A mistakes retake is a different test: no class to compare it with.
    attempt.questionIds ? [] : repo.classScores(attempt.mockId, attempt.clientId),
  ]);
  const questions = MockGrader.subset(all, attempt.questionIds);
  const mine = new Map(responses.map((r) => [r.questionId, r]));
  const seconds = ((attempt.submittedAt ?? attempt.endsAt).getTime() - attempt.startedAt.getTime()) / 1000;
  return (
    <MockResults
      attemptId={attempt.id}
      title={attempt.questionIds ? `${title}: mistakes retake` : title}
      readOnly={readOnly}
      grade={MockGrader.grade(questions, responses)}
      seconds={seconds}
      classAverage={MockGrader.classAverage(others)}
      paceSeconds={mock ? Math.round(MockContract.pace(mock) * 60) : null}
      retake={readOnly ? null : await retakeOptions(repo, attempt, MockGrader.mistakes(questions, responses).length)}
      questions={MockGrader.arrange(questions, seed).map((q) => ({
        ...renderQuestion(q),
        topic: q.topic,
        correct: q.correct,
        explanation: q.explanation ? <ExhibitText text={q.explanation} /> : null,
        why: q.why.map((w, i) => (w ? <Inline key={i} text={w} /> : null)) as ReviewQuestion["why"],
        seconds: mine.get(q.id)?.seconds ?? 0,
        confidence: mine.get(q.id)?.confidence ?? null,
        selected: mine.get(q.id)?.selected ?? null,
        flagged: mine.get(q.id)?.flagged ?? false,
        notes: mine.get(q.id)?.notes ?? "",
      }))}
    />
  );
}

/** Null once the mock is unpublished or no longer open to the student. */
async function retakeOptions(repo: MockRepository, attempt: MockAttempt, mistakes: number): Promise<RetakeOptions | null> {
  const [mocks, open] = await Promise.all([repo.published(attempt.clientId), repo.openAttempt(attempt.clientId, attempt.mockId)]);
  const mock = mocks.find((m) => m.id === attempt.mockId);
  if (!mock) return null;
  return {
    mockId: mock.id,
    fullQuestions: mock.questionCount,
    fullMinutes: mock.durationMinutes * MockContract.sessions(mock),
    mistakes,
    mistakeMinutes: MockContract.retakeMinutes(mock, mistakes),
    open,
  };
}
