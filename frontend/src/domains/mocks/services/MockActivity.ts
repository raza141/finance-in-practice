import type { MockActivityRow } from "../types";

export type ActivityState = "running" | "paused" | "time_up" | "completed";

/** Where an attempt stands on the owner's activity page. Pure, so it's tested without a database. */
export class MockActivity {
  static readonly LONG_MS = 86_400_000;

  /**
   * "time_up": the clock ran out but nobody submitted (the student left; it closes when they come back).
   * A paused attempt's ends_at is stale until resume, so a pause is never time up.
   */
  static state(a: Pick<MockActivityRow, "status" | "pausedAt" | "endsAt">, now: Date): ActivityState {
    if (a.status === "completed") return "completed";
    if (a.pausedAt) return "paused";
    return a.endsAt.getTime() < now.getTime() ? "time_up" : "running";
  }

  /** Open for more than a day since it was started: worth a nudge. */
  static isLong(a: Pick<MockActivityRow, "status" | "startedAt">, now: Date): boolean {
    return a.status === "in_progress" && now.getTime() - a.startedAt.getTime() > MockActivity.LONG_MS;
  }
}
