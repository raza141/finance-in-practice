import "server-only";

import type { ReactNode } from "react";

import { Inline } from "@/domains/journal/components/RichText";

import type { MockRepository } from "../server/MockRepository";
import { MockGrader } from "../services/MockGrader";
import type { ActiveQuestion, MockAttempt } from "../types";
import { ExhibitText } from "./ExhibitText";
import { MockResults } from "./MockResults";

/** Question text as the player and the results show it: KaTeX, tables and charts rendered on the server. */
export const renderQuestion = (q: ActiveQuestion) => ({
  id: q.id,
  number: q.number,
  vignette: q.vignette ? <ExhibitText text={q.vignette} /> : null,
  question: <ExhibitText text={q.question} />,
  options: q.options.map((o, i) => <Inline key={i} text={o} />) as [ReactNode, ReactNode, ReactNode],
});

/** A closed attempt's score, topics and every question, in the order that attempt showed them. The student's page and the owner's both use it. */
export async function AttemptResults({ repo, attempt, title, readOnly = false }: { repo: MockRepository; attempt: MockAttempt; title: string; readOnly?: boolean }) {
  const [questions, responses, seed] = await Promise.all([repo.questions(attempt.mockId), repo.responses(attempt.id), repo.seed(attempt)]);
  const mine = new Map(responses.map((r) => [r.questionId, r]));
  const seconds = ((attempt.submittedAt ?? attempt.endsAt).getTime() - attempt.startedAt.getTime()) / 1000;
  return (
    <MockResults
      attemptId={attempt.id}
      title={title}
      readOnly={readOnly}
      grade={MockGrader.grade(questions, responses)}
      seconds={seconds}
      questions={MockGrader.arrange(questions, seed).map((q) => ({
        ...renderQuestion(q),
        topic: q.topic,
        correct: q.correct,
        explanation: q.explanation ? <ExhibitText text={q.explanation} /> : null,
        selected: mine.get(q.id)?.selected ?? null,
        flagged: mine.get(q.id)?.flagged ?? false,
        notes: mine.get(q.id)?.notes ?? "",
      }))}
    />
  );
}
