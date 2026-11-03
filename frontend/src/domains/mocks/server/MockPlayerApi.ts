import "server-only";

import type { MockResponse } from "../types";
import { MockContract } from "../services/MockContract";
import { MockGrader } from "../services/MockGrader";
import { MockSession } from "./MockSession";

/**
 * What the open exam asks of the server: save, pause, resume, submit, and (on a full mock's break) start the next session. Served by a Route Handler
 * (`/api/student/mocks/[attemptId]`), not Server Actions: an exam stays open for hours, and a deploy in
 * that time retires every Server Action ID its page holds, so a student could neither save nor submit.
 * A URL outlives deploys. Keep the request body backward compatible: old pages still send the old shape.
 */
export class MockPlayerApi {
  static readonly OPS = ["save", "pause", "resume", "submit", "next"] as const;

  /** How far the browser's clock may run ahead of the server's before its auto submit counts as stale. */
  static readonly CLOCK_SLACK_MS = 5_000;

  static isOp(op: unknown): op is (typeof MockPlayerApi.OPS)[number] {
    return MockPlayerApi.OPS.includes(op as never);
  }

  /** `open` false: the attempt (or its session) is closed or its clock ran out, so the player submits. Paused elsewhere: still open. */
  static async save(clientId: string, attemptId: string, sent: MockResponse[]): Promise<{ open: boolean }> {
    const repo = MockSession.repo();
    const attempt = await repo.attempt(attemptId, clientId);
    if (attempt?.status !== "in_progress") return { open: false };
    if (attempt.pausedAt) return { open: true };
    // Only the session the attempt is in: a full mock's first half is locked once its break starts.
    const { current } = await MockSession.questions(repo, attempt);
    return { open: await repo.autosave(attemptId, clientId, MockSession.only(sent, current), attempt.session) };
  }

  /** Saves what the browser has, then stops the clock. */
  static async pause(clientId: string, attemptId: string, sent: MockResponse[]): Promise<{ ok: boolean }> {
    await MockPlayerApi.save(clientId, attemptId, sent);
    return { ok: await MockSession.repo().pause(attemptId, clientId) };
  }

  /** Restarts the clock; the player carries on from the server's new end time. Null: the attempt isn't open any more. */
  static async resume(clientId: string, attemptId: string): Promise<{ remainingMs: number | null }> {
    const repo = MockSession.repo();
    await repo.resume(attemptId, clientId);
    const attempt = await repo.attempt(attemptId, clientId);
    return { remainingMs: attempt?.status === "in_progress" && !attempt.pausedAt ? MockGrader.remainingMs(attempt.endsAt) : null };
  }

  /**
   * Grades and closes the attempt (or ends session 1 of a full mock). A repeat submit is a no-op.
   * `stale`: not closed, because the clock is paused, or, for the player's own `auto` submit, the server's
   * clock still has time (paused and resumed in another tab); the player reloads onto the real clock.
   */
  static async submit(clientId: string, attemptId: string, sent: MockResponse[], auto = false): Promise<{ ok: boolean; stale?: boolean }> {
    const repo = MockSession.repo();
    const attempt = await repo.attempt(attemptId, clientId);
    if (!attempt) return { ok: false };
    if (attempt.status !== "in_progress") return { ok: true };
    if (attempt.pausedAt || (auto && MockGrader.remainingMs(attempt.endsAt) > MockPlayerApi.CLOCK_SLACK_MS)) return { ok: true, stale: true };
    await MockSession.finish(repo, attempt, sent);
    return { ok: true };
  }

  /** Ends a full mock's break early: session 2's clock starts now. */
  static async next(clientId: string, attemptId: string): Promise<{ ok: boolean }> {
    return { ok: await MockSession.repo().startSession(attemptId, clientId) };
  }

  /** The request body, checked: `responses` through `MockContract.parseResponses`. Null: not a request we know. */
  static parse(body: unknown): { op: (typeof MockPlayerApi.OPS)[number]; responses: MockResponse[]; auto: boolean } | null {
    if (typeof body !== "object" || body === null) return null;
    const { op, responses, auto } = body as Record<string, unknown>;
    if (!MockPlayerApi.isOp(op)) return null;
    return { op, responses: MockContract.parseResponses(responses), auto: auto === true };
  }
}
