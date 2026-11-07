import { describe, expect, it } from "vitest";

import { Batches } from "./Batches";

const windows = Batches.windows("CFA1")!;
const now = new Date("2026-10-17T09:00:00Z");

describe("Batches", () => {
  it("offers a running batch even inside the prep cutoff, then the next sittings, up to three", () => {
    // Nov 2026 is under 42 days away: shown only because its batch is open.
    expect(Batches.offer(windows, [], now)).toEqual(["Feb 2027", "May 2027", "Aug 2027"]);
    expect(Batches.offer(windows, [{ label: "Nov 2026", examDate: "2026-11-10" }], now)).toEqual(["Nov 2026", "Feb 2027", "May 2027"]);
  });

  it("drops a batch once its exam has passed", () => {
    const later = new Date("2026-11-11T09:00:00Z");
    expect(Batches.offer(windows, [{ label: "Nov 2026", examDate: "2026-11-10" }], later)).not.toContain("Nov 2026");
  });

  it("lets the owner assign any opened batch or sitting ahead, without repeats", () => {
    const opened = [{ label: "Aug 2026", examDate: "2026-08-15" }, { label: "Feb 2027", examDate: "2027-02-20" }];
    expect(Batches.assignable(windows, opened, now)).toEqual(["Aug 2026", "Nov 2026", "Feb 2027", "May 2027", "Aug 2027", "Nov 2027"]);
  });

  it("has no batches for courses without sittings", () => {
    expect(Batches.windows("UNI")).toBeNull();
    expect(Batches.windows(null)).toBeNull();
  });
});

describe("Batches.examPick", () => {
  it("stays inside the batch's month", () => {
    expect(Batches.examPick("2026-11-10", "2026-10-01")).toEqual({ min: "2026-11-01", max: "2026-11-30" });
    expect(Batches.examPick("2027-02-20", "2026-11-07")).toEqual({ min: "2027-02-01", max: "2027-02-28" });
  });
  it("never offers a day in the past", () => {
    expect(Batches.examPick("2026-11-10", "2026-11-07").min).toBe("2026-11-07");
  });
});
