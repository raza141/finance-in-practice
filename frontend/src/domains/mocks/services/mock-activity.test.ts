import { describe, expect, it } from "vitest";

import { MockActivity } from "./MockActivity";

const now = new Date("2026-11-03T12:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("MockActivity", () => {
  it("classifies an attempt", () => {
    expect(MockActivity.state({ status: "completed", pausedAt: null, endsAt: ago(5) }, now)).toBe("completed");
    expect(MockActivity.state({ status: "in_progress", pausedAt: null, endsAt: ago(-1) }, now)).toBe("running");
    expect(MockActivity.state({ status: "in_progress", pausedAt: null, endsAt: ago(1) }, now)).toBe("time_up");
    // A paused attempt's end time is stale: still paused, not time up.
    expect(MockActivity.state({ status: "in_progress", pausedAt: ago(30), endsAt: ago(29) }, now)).toBe("paused");
  });

  it("flags an open attempt older than a day", () => {
    expect(MockActivity.isLong({ status: "in_progress", startedAt: ago(25) }, now)).toBe(true);
    expect(MockActivity.isLong({ status: "in_progress", startedAt: ago(23) }, now)).toBe(false);
    expect(MockActivity.isLong({ status: "completed", startedAt: ago(48) }, now)).toBe(false);
  });
});
