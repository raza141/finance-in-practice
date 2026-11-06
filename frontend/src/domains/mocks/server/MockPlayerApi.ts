import "server-only";

import type { MockAttempt, MockResponse } from "../types";
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
  static readonly OPS = ["save", "pause", "resume", "submit", "next", "claim"] as const;

  /** How far the browser's clock may run ahead of the server's before its auto submit counts as stale. */
  static readonly CLOCK_SLACK_MS = 5_000;

  static isOp(op: unknown): op is (typeof MockPlayerApi.OPS)[number] {
    return MockPlayerApi.OPS.includes(op as never);
  }

  /**
   * Another screen has the attempt: this one may not write, so two open screens can't overwrite each other's answers.
   * A page from before screens existed sends none: it may write only while no screen has claimed the attempt.
   */
  static taken(attempt: MockAttempt, screen: string | null): boolean {
    return attempt.screen !== null && attempt.screen !== screen;
  }

  /** The screen that just opened the attempt takes it over. Always ok: a closed attempt shows up on the next save. */
  static async claim(clientId: string, attemptId: string, screen: string): Promise<{ ok: boolean }> {
    await MockSession.repo().claimScreen(attemptId, clientId, screen);
    return { ok: true };
  }

  /**
   * `open` false: the attempt (or its session) is closed or its clock ran out, so the player submits. Paused elsewhere: still open.
   * `taken`: another screen has it; nothing was written.
   */
  static async save(clientId: string, attemptId: string, sent: MockResponse[], screen: string | null = null): Promise<{ open: boolean; taken?: boolean }> {
    const repo = MockSession.repo();
    const attempt = await repo.attempt(attemptId, clientId);
    if (attempt?.status !== "in_progress") return { open: false };
    if (MockPlayerApi.taken(attempt, screen)) return { open: true, taken: true };
    if (attempt.pausedAt) return { open: true };
    // Nothing sent (the player checking it still holds the attempt): no questions loaded, nothing written.
    if (sent.length === 0) return { open: MockGrader.open(attempt.endsAt) };
    // Only the session the attempt is in: a full mock's first half is locked once its break starts.
    const { current } = await MockSession.questions(repo, attempt);
    return { open: await repo.autosave(attemptId, clientId, MockSession.only(sent, current), attempt.session) };
  }

  /** Saves what the browser has, then stops the clock. */
  static async pause(clientId: string, attemptId: string, sent: MockResponse[], screen: string | null = null): Promise<{ ok: boolean; taken?: boolean }> {
    if ((await MockPlayerApi.save(clientId, attemptId, sent, screen)).taken) return { ok: false, taken: true };
    return { ok: await MockSession.repo().pause(attemptId, clientId) };
  }

  /** Restarts the clock; the player carries on from the server's new end time. Null: the attempt isn't open any more. */
  static async resume(clientId: string, attemptId: string, screen: string | null = null): Promise<{ remainingMs: number | null; taken?: boolean }> {
    const repo = MockSession.repo();
    const before = await repo.attempt(attemptId, clientId);
    if (before && MockPlayerApi.taken(before, screen)) return { remainingMs: null, taken: true };
    await repo.resume(attemptId, clientId);
    const attempt = await repo.attempt(attemptId, clientId);
    return { remainingMs: attempt?.status === "in_progress" && !attempt.pausedAt ? MockGrader.remainingMs(attempt.endsAt) : null };
  }

  /**
   * Grades and closes the attempt (or ends session 1 of a full mock). A repeat submit is a no-op.
   * `stale`: not closed, because the clock is paused, or, for the player's own `auto` submit, the server's
   * clock still has time (paused and resumed in another tab); the player reloads onto the real clock.
   * `taken` (with `stale`, so a page from before screens existed reloads too): another screen has it.
   */
  static async submit(clientId: string, attemptId: string, sent: MockResponse[], auto = false, screen: string | null = null): Promise<{ ok: boolean; stale?: boolean; taken?: boolean }> {
    const repo = MockSession.repo();
    const attempt = await repo.attempt(attemptId, clientId);
    if (!attempt) return { ok: false };
    if (attempt.status !== "in_progress") return { ok: true };
    if (MockPlayerApi.taken(attempt, screen)) return { ok: true, stale: true, taken: true };
    if (attempt.pausedAt || (auto && MockGrader.remainingMs(attempt.endsAt) > MockPlayerApi.CLOCK_SLACK_MS)) return { ok: true, stale: true };
    await MockSession.finish(repo, attempt, sent);
    return { ok: true };
  }

  /** Ends a full mock's break early: session 2's clock starts now. */
  static async next(clientId: string, attemptId: string): Promise<{ ok: boolean }> {
    return { ok: await MockSession.repo().startSession(attemptId, clientId) };
  }

  /** The request body, checked: `responses` through `MockContract.parseResponses`. Null: not a request we know. */
  static parse(body: unknown): { op: (typeof MockPlayerApi.OPS)[number]; responses: MockResponse[]; auto: boolean; screen: string | null } | null {
    if (typeof body !== "object" || body === null) return null;
    const { op, responses, auto, screen } = body as Record<string, unknown>;
    if (!MockPlayerApi.isOp(op)) return null;
    return { op, responses: MockContract.parseResponses(responses), auto: auto === true, screen: MockContract.isUuid(screen) ? screen : null };
  }
}
