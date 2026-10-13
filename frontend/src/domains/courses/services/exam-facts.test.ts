import { describe, expect, it } from "vitest";

import { ExamFacts } from "./ExamFacts";

describe("ExamFacts", () => {
  it("shows only windows far enough out to prepare for", () => {
    const frm = ExamFacts.for("FRM1")!;
    // 10 Oct 2026: Nov 2026 is under six weeks away, so the next are May and Aug 2027.
    expect(ExamFacts.nextWindows(frm, new Date("2026-10-10T00:00:00Z")).map((w) => w.label)).toEqual(["May 2027", "Aug 2027"]);
    expect(ExamFacts.nextWindows(frm, new Date("2026-09-01T00:00:00Z")).map((w) => w.label)).toEqual(["Nov 2026", "May 2027"]);
    expect(ExamFacts.nextWindows(frm, new Date("2030-01-01T00:00:00Z"))).toEqual([]);
  });

  it("counts down in calendar months", () => {
    const feb = { label: "Feb 2027", starts: "2027-02-20" };
    expect(ExamFacts.countdown(feb, new Date("2026-10-13T00:00:00Z"))).toBe("in 4 months");
    expect(ExamFacts.countdown(feb, new Date("2027-01-31T00:00:00Z"))).toBe("next month");
    expect(ExamFacts.countdown(feb, new Date("2027-02-01T00:00:00Z"))).toBe("this month");
  });

  it("has no profile for non-exam courses", () => {
    expect(ExamFacts.for(null)).toBeNull();
    expect(ExamFacts.for("UNI")).toBeNull();
  });
});
