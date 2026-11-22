import { describe, expect, it } from "vitest";

import { StudyGoalContract } from "./StudyGoalContract";
import { StudyPlan } from "./StudyPlan";
import { StudySchedule } from "./StudySchedule";

const every = new StudySchedule([{ from: "2026-11-01", timeZone: "Asia/Dubai", days: [1, 2, 3, 4, 5, 6, 7] }]);
const goal = { examOn: "2026-12-02", startedOn: "2026-11-02", targetHours: 300, hoursPerDay: 8, priorMinutes: 0 };
const state = (over: object = {}, minutes: { date: string; minutes: number }[] = [], today = "2026-11-22", schedule = every) =>
  StudyPlan.state({ goal: { ...goal, ...over }, schedule, minutes, today });

describe("StudyPlan", () => {
  it("counts down and spreads what's left over the study days before the exam", () => {
    const s = state({}, [{ date: "2026-11-10", minutes: 200 * 60 }]);
    expect(s).toMatchObject({ daysLeft: 10, hoursDone: 200, perDay: 10, todayHours: 10, elapsed: 20, total: 30, overCapacity: true });
  });
  it("takes today's study off today's hours", () => {
    const s = state({}, [{ date: "2026-11-10", minutes: 200 * 60 }, { date: "2026-11-22", minutes: 120 }]);
    expect(s.todayHours).toBeCloseTo(8);
    expect(s.perDay).toBeCloseTo(9.8);
  });
  it("counts hours from before joining, not tracked ones from before the start", () => {
    expect(state({ priorMinutes: 600 }, [{ date: "2026-10-01", minutes: 999 }]).hoursDone).toBe(10);
  });
  it("shows no daily figure with no study days left, or no exam date", () => {
    expect(state({}, [], "2026-12-02")).toMatchObject({ daysLeft: 0, perDay: null, todayHours: 0 });
    expect(state({}, [], "2026-12-09")).toMatchObject({ daysLeft: -7, perDay: null, elapsed: 30 });
    expect(state({ examOn: null })).toMatchObject({ daysLeft: null, perDay: null, total: 0 });
  });
  it("asks nothing once the target is met, or on a rest day", () => {
    expect(state({ priorMinutes: 400 * 60 })).toMatchObject({ perDay: 0, todayHours: 0, overCapacity: false });
    const weekdays = new StudySchedule([{ from: "2026-11-01", timeZone: "Asia/Dubai", days: [1, 2, 3, 4, 5] }]);
    expect(state({}, [], "2026-11-22", weekdays)).toMatchObject({ restDay: true, todayHours: 0 });
  });
});

describe("StudySchedule", () => {
  it("applies a change the day after it's saved, never to that day or earlier", () => {
    // 20 Nov 2026 is a Friday, 27 Nov the next one.
    const s = new StudySchedule([
      { from: "2026-11-01", timeZone: "Asia/Dubai", days: [1, 2, 3, 4, 5] },
      { from: "2026-11-20", timeZone: "Europe/London", days: [1, 2, 3, 4] },
    ]);
    expect([s.planned("2026-11-13"), s.planned("2026-11-20"), s.planned("2026-11-27")]).toEqual([true, true, false]);
    expect(s.timeZone).toBe("Europe/London");
  });
  it("is today in the student's own zone", () => {
    const at = new Date("2026-11-22T20:30:00Z");
    const today = (timeZone: string) => new StudySchedule([{ from: "2026-01-01", timeZone, days: [1] }]).today(at);
    expect([today("Asia/Dubai"), today("America/New_York")]).toEqual(["2026-11-23", "2026-11-22"]);
  });
});

describe("StudyGoalContract", () => {
  const now = new Date("2026-11-22T08:00:00Z");
  const options = [
    { course: "CFA Level I", level: 1 as const, examOn: null },
    { course: "CFA Level II", level: 2 as const, examOn: "2027-05-15" },
  ];
  const form = (over: Record<string, string | string[]> = {}) => {
    const data = new FormData();
    const all = { course: "CFA Level I", timeZone: "Asia/Dubai", startedOn: "2026-10-01", examOn: "2027-02-22", targetHours: "300", hoursPerDay: "2.5", priorHours: "", studyDays: ["6", "1", "3"], ...over };
    for (const [key, value] of Object.entries(all)) for (const v of [value].flat()) data.append(key, v);
    return data;
  };
  it("accepts a plan", () => {
    const r = StudyGoalContract.goal(form(), options, now);
    expect(r).toMatchObject({ ok: true, value: { targetHours: 300, hoursPerDay: 2.5, priorMinutes: 0, studyDays: [1, 3, 6], examOn: "2027-02-22" } });
  });
  it("never stores a typed date beside a batch's", () => {
    expect(StudyGoalContract.goal(form({ course: "CFA Level II" }), options, now)).toMatchObject({ ok: true, value: { examOn: null } });
  });
  it.each([
    ["another course", { course: "FRM Part I" }],
    ["a made-up zone", { timeZone: "Mars/Base" }],
    ["a future start", { startedOn: "2026-11-23" }],
    ["a past exam", { examOn: "2026-11-22" }],
    ["an impossible date", { examOn: "2027-02-31" }],
    ["a tiny target", { targetHours: "5" }],
    ["no hours a day", { hoursPerDay: "0" }],
    ["no study days", { studyDays: [] }],
    ["an eighth day", { studyDays: ["8"] }],
  ])("refuses %s", (_, over) => {
    expect(StudyGoalContract.goal(form(over), options, now).ok).toBe(false);
  });
  it("logs today or yesterday, 8 hours at most", () => {
    const log = (date: string, minutes: string, kind = "reading") => {
      const data = new FormData();
      data.set("date", date);
      data.set("minutes", minutes);
      data.set("kind", kind);
      return StudyGoalContract.log(data, "2026-11-22").ok;
    };
    expect([log("2026-11-22", "45"), log("2026-11-21", "480")]).toEqual([true, true]);
    expect([log("2026-11-20", "45"), log("2026-11-23", "45"), log("2026-11-22", "481"), log("2026-11-22", "45", "tv")]).toEqual([false, false, false, false]);
  });
});
