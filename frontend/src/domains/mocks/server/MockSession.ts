import "server-only";

import type { MockAttempt, MockResponse } from "../types";
import { MockGrader } from "../services/MockGrader";
import { MockRepository } from "./MockRepository";

/** Closing an attempt: on submit, at the timer, or when a student comes back to one whose clock ran out. */
export class MockSession {
  static repo(): MockRepository {
    const repo = MockRepository.fromEnv();
    if (!repo) throw new Error("DATABASE_URL is not configured");
    return repo;
  }

  /** Grades the final answers and closes the attempt. False: it was already closed (a second submit). */
  static async finish(repo: MockRepository, attempt: MockAttempt, sent: MockResponse[] = []): Promise<boolean> {
    const [questions, stored] = await Promise.all([repo.questions(attempt.mockId), repo.responses(attempt.id)]);
    const final = MockGrader.merge(stored, sent, MockGrader.open(attempt.endsAt));
    return repo.complete(attempt.id, attempt.clientId, MockGrader.grade(questions, final), final);
  }

  /** The attempt, closed first if its clock ran out while the student was away. */
  static async load(repo: MockRepository, attemptId: string, clientId: string): Promise<MockAttempt | null> {
    const attempt = await repo.attempt(attemptId, clientId);
    if (attempt?.status !== "in_progress" || MockGrader.open(attempt.endsAt)) return attempt;
    await MockSession.finish(repo, attempt);
    return repo.attempt(attemptId, clientId);
  }
}
