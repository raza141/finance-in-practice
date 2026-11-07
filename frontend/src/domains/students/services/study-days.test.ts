import { describe, expect, it } from "vitest";

import type { AttemptSummary } from "@/domains/mocks/types";

import type { StudentSession, StudyPlanItem } from "../types";
import { StudyDays } from "./StudyDays";

const item = (id: string, dueOn: string | null, status: StudyPlanItem["status"] = "planned"): StudyPlanItem => ({ id, dueOn, startOn: null, mockId: null, topic: id, status, note: "", materialUrl: null, studentChangedAt: null });
const session = (uid: string, start: string): StudentSession => ({ uid, start, end: start, minutes: 60, course: "CFA Level I", status: "accepted", meetingUrl: null, address: null, group: false });
const attempt = (id: string, submittedAt: string, score: number): AttemptSummary => ({ id, mockId: "m", mockTitle: "QM mock", startedAt: new Date(submittedAt), submittedAt: new Date(submittedAt), score, total: 20, status: "completed", mistakes: false });

describe("StudyDays.build", () => {
  const { days, unscheduled } = StudyDays.build({
    items: [item("late", "2026-11-02"), item("done", "2026-11-03", "done"), item("fixed", "2026-11-12"), item("someday", null), item("dropped", null, "skipped")],
    // 21:30 UTC on the 9th is the 10th in Abu Dhabi.
    sessions: [session("s1", "2026-11-09T21:30:00Z")],
    attempts: [attempt("a1", "2026-11-05T10:00:00Z", 15), { ...attempt("open", "2026-11-06T10:00:00Z", 0), status: "in_progress", submittedAt: null, score: null }],
    exam: { course: "CFA Level I", date: "2026-11-17" },
    bankTopics: ["Fixed Income"],
    today: "2026-11-07",
  });

  it("carries an overdue topic to today, and leaves done ones on their day", () => {
    expect(days["2026-11-07"].map((d) => d.id)).toEqual(["late"]);
    expect(days["2026-11-03"].map((d) => d.id)).toEqual(["done"]);
    expect(days["2026-11-02"]).toBeUndefined();
  });

  it("puts sessions and finished mocks on their UAE day, and the exam with days left", () => {
    expect(days["2026-11-10"]).toMatchObject([{ kind: "session", time: "1:30 am" }]);
    expect(days["2026-11-05"]).toMatchObject([{ kind: "mock", percent: 75 }]);
    expect(days["2026-11-06"]).toBeUndefined();
    expect(days["2026-11-17"]).toMatchObject([{ kind: "exam", days: 10 }]);
  });

  it("keeps undated planned topics apart, and matches topics to the bank", () => {
    expect(unscheduled.map((u) => u.id)).toEqual(["someday"]);
    expect(days["2026-11-12"]).toMatchObject([{ test: "Fixed Income" }]);
  });
});

describe("StudyDays ranges and scheduled mocks", () => {
  const { days } = StudyDays.build({
    items: [
      { ...item("books", "2026-11-12"), startOn: "2026-11-10" },
      { ...item("mock1", "2026-11-20"), mockId: "m" },
      { ...item("mock2", "2026-11-21"), mockId: "m2" },
    ],
    sessions: [],
    attempts: [attempt("a1", "2026-11-05T10:00:00Z", 15)],
    exam: null,
    bankTopics: [],
    openMocks: ["m2"],
    today: "2026-11-07",
  });

  it("lays a range across its days as one band", () => {
    expect(["2026-11-10", "2026-11-11", "2026-11-12"].map((d) => (days[d][0] as { span: string }).span)).toEqual(["start", "mid", "end"]);
    expect(days["2026-11-13"]).toBeUndefined();
  });

  it("ticks a scheduled mock once it's finished, and offers Start only when it's open", () => {
    expect(days["2026-11-20"]).toMatchObject([{ status: "done", mock: { id: "m", open: false } }]);
    expect(days["2026-11-21"]).toMatchObject([{ status: "planned", mock: { id: "m2", open: true } }]);
  });
});

describe("StudyDays calendar helpers", () => {
  it("lays a month out in Monday-first weeks", () => {
    const weeks = StudyDays.monthGrid("2026-11");
    expect(weeks[0][0]).toBe("2026-10-26");
    expect(weeks.at(-1)!.at(-1)).toBe("2026-12-06");
    expect(StudyDays.shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("matches a plan topic to the bank topic it's about", () => {
    const bank = ["Ethics", "Equity", "Fixed Income", "Quantitative Methods"];
    expect(StudyDays.match("Ethics & Professional Standards", bank)).toBe("Ethics");
    expect(StudyDays.match("Quant", bank)).toBe("Quantitative Methods");
    expect(StudyDays.match("Mock exam 2", bank)).toBeNull();
  });
});
