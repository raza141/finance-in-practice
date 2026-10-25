import "server-only";

import type { MockAttempt, MockQuestion, MockResponse } from "../types";
import { MockContract } from "../services/MockContract";
import { MockGrader } from "../services/MockGrader";
import { MockRepository } from "./MockRepository";

/**
 * Closing an attempt (or, in a full mock, its first session): on submit, at the timer, or when a
 * student comes back to one whose clock ran out. Only the current session's answers are ever taken,
 * so session 1 is locked once the break starts.
 */
export class MockSession {
  static repo(): MockRepository {
    const repo = MockRepository.fromEnv();
    if (!repo) throw new Error("DATABASE_URL is not configured");
    return repo;
  }

  /** The attempt's questions in its order, and the ones of the session it's in. */
  static async questions(repo: MockRepository, attempt: MockAttempt): Promise<{ all: MockQuestion[]; current: MockQuestion[]; sessions: 1 | 2 }> {
    const [questions, seed, mock] = await Promise.all([repo.questions(attempt.mockId), repo.seed(attempt), repo.byId(attempt.mockId)]);
    const sessions = mock ? MockContract.sessions(mock) : 1;
    const all = MockGrader.arrange(questions, seed);
    return { all, current: MockGrader.session(all, sessions, attempt.session), sessions };
  }

  /** What the browser sent, kept to the current session's questions. */
  static only(sent: readonly MockResponse[], current: readonly MockQuestion[]): MockResponse[] {
    const ids = new Set(current.map((q) => q.id));
    return sent.filter((r) => ids.has(r.questionId));
  }

  /**
   * Grades and closes the attempt, or ends session 1 of a full mock (the break starts). False: it
   * had already moved on (a second submit).
   */
  static async finish(repo: MockRepository, attempt: MockAttempt, sent: MockResponse[] = []): Promise<boolean> {
    const [{ all, current, sessions }, stored] = await Promise.all([MockSession.questions(repo, attempt), repo.responses(attempt.id)]);
    const final = MockGrader.merge(stored, MockSession.only(sent, current), MockGrader.open(attempt.endsAt));
    if (sessions === 2 && attempt.session === 1) return repo.endSession(attempt.id, attempt.clientId, MockSession.only(final, current));
    return repo.complete(attempt.id, attempt.clientId, MockGrader.grade(all, final), final);
  }

  /** The attempt, moved on first if its clock ran out while the student was away (a full mock may need both steps). A paused clock hasn't run out. */
  static async load(repo: MockRepository, attemptId: string, clientId: string): Promise<MockAttempt | null> {
    let attempt = await repo.attempt(attemptId, clientId);
    for (let step = 0; step < 2 && attempt?.status === "in_progress" && !attempt.pausedAt && !MockGrader.open(attempt.endsAt); step++) {
      await MockSession.finish(repo, attempt);
      attempt = await repo.attempt(attemptId, clientId);
    }
    return attempt;
  }

  /** On its break: session 1 closed, session 2 not started yet. */
  static onBreak(attempt: MockAttempt, now = new Date()): boolean {
    return attempt.status === "in_progress" && attempt.breakUntil !== null && attempt.breakUntil.getTime() > now.getTime();
  }
}
