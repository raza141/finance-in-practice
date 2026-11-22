import { describe, expect, it } from "vitest";

import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import type { DayTotal } from "../types";
import { StreakEngine } from "./StreakEngine";
import { StudySchedule } from "./StudySchedule";

const every = new StudySchedule([{ from: "2026-01-01", timeZone: "Asia/Dubai", days: [1, 2, 3, 4, 5, 6, 7] }]);
/** One character a day from `start`: x counts, . nothing, D double the bar, h half the bar. */
function days(start: string, pattern: string): DayTotal[] {
  const questions = { x: 20, ".": 0, D: 40, h: 10 } as Record<string, number>;
  return [...pattern].map((c, i) => ({ date: ZonedCalendar.addDays(start, i), questions: questions[c], minutes: 0 }));
}
/** `pattern` ends today. */
function run(start: string, pattern: string, schedule = every, trackedFrom = start) {
  return StreakEngine.state({ days: days(start, pattern), schedule, today: ZonedCalendar.addDays(start, pattern.length - 1), trackedFrom });
}

describe("qualifying", () => {
  it("by questions", () => expect([19, 20].map((questions) => StreakEngine.qualifies({ questions, minutes: 0 }))).toEqual([false, true]));
  it("by minutes", () => expect([44.9, 45].map((minutes) => StreakEngine.qualifies({ questions: 0, minutes }))).toEqual([false, true]));
});

describe("streak", () => {
  it("counts days in a row", () => expect(run("2026-11-02", "xxxxx")).toMatchObject({ current: 5, best: 5, perfect: true, qualifiedToday: true }));
  it("isn't broken by an unfinished today", () => expect(run("2026-11-02", "xxxx.")).toMatchObject({ current: 4, freezesLeft: 2, perfect: true, qualifiedToday: false }));
  it("ignores rest days, and counts studying on one", () => {
    const weekdays = new StudySchedule([{ from: "2026-01-01", timeZone: "Asia/Dubai", days: [1, 2, 3, 4, 5] }]);
    expect(run("2026-11-02", "xxxxx..xxxxx..x", weekdays)).toMatchObject({ current: 11, perfect: true, freezesLeft: 2 });
    expect(run("2026-11-02", "xxxxxx.x", weekdays).current).toBe(7);
  });
  it("crosses months, years and a DST change", () => {
    expect(run("2026-12-30", "xxxxx").current).toBe(5);
    const london = new StudySchedule([{ from: "2026-01-01", timeZone: "Europe/London", days: [1, 2, 3, 4, 5, 6, 7] }]);
    expect(run("2026-10-24", "xxx", london).current).toBe(3);
    expect([london.today(new Date("2026-10-24T22:59:00Z")), london.today(new Date("2026-10-24T23:01:00Z")), london.today(new Date("2026-10-25T23:59:00Z"))]).toEqual(["2026-10-24", "2026-10-25", "2026-10-25"]);
  });
  it("reaches milestones at 7, 30, 100 and 365", () => expect([0, 7, 99, 365].map((n) => StreakEngine.nextMilestone(n))).toEqual([7, 30, 100, null]));
});

describe("freezes", () => {
  it("are applied by themselves, and cost the perfect badge", () =>
    expect(run("2026-11-02", "xx.x")).toMatchObject({ current: 3, freezesLeft: 1, perfect: false, earnBack: null }));
  it("reset each month", () => {
    expect(run("2026-11-26", "x..xx")).toMatchObject({ current: 3, freezesLeft: 0 });
    expect(run("2026-11-26", "x..xxx")).toMatchObject({ current: 4, freezesLeft: 2 });
    expect(run("2026-11-26", "x..xxx..x")).toMatchObject({ current: 5, freezesLeft: 0, earnBack: null, breaks: [] });
  });
  it("don't roll over", () => expect(run("2026-11-28", "xxxx...x")).toMatchObject({ freezesLeft: 0, earnBack: { missed: "2026-12-04" } }));
  it("aren't spent with no streak to keep", () => expect(run("2026-11-02", "....x")).toMatchObject({ current: 1, freezesLeft: 2 }));
});

describe("Earn Back", () => {
  it("opens when no freeze is left, and keeps the streak meanwhile", () =>
    expect(run("2026-11-02", "xxx....").earnBack).toEqual({ missed: "2026-11-07", until: "2026-11-09", questionsLeft: 40, minutesLeft: 90 }));
  it("restores within the 48 hours, on the first day or the second", () => {
    expect(run("2026-11-02", "xxx...D")).toMatchObject({ current: 4, earnBack: null, breaks: [], perfect: false });
    expect(run("2026-11-02", "xxx...xx")).toMatchObject({ current: 5, earnBack: null, breaks: [] });
  });
  it("restores by minutes", () => {
    const list = [...days("2026-11-02", "xxx..."), { date: "2026-11-08", questions: 0, minutes: 90 }];
    expect(StreakEngine.state({ days: list, schedule: every, today: "2026-11-08", trackedFrom: "2026-11-02" })).toMatchObject({ current: 4, earnBack: null });
  });
  it("says what's left part-way", () => expect(run("2026-11-02", "xxx...x")).toMatchObject({ current: 4, best: 3, earnBack: { questionsLeft: 20 } }));
  it("is still open on the second day, whatever the hour", () =>
    expect(run("2026-11-02", "xxx...x.")).toMatchObject({ current: 4, breaks: [], earnBack: { missed: "2026-11-07", until: "2026-11-09" } }));
  it("expires after the 48 hours", () => {
    expect(run("2026-11-02", "xxx......")).toMatchObject({ current: 0, best: 3, breaks: ["2026-11-07"], earnBack: null, perfect: false });
    expect(run("2026-11-02", "xxx......x")).toMatchObject({ current: 1, breaks: ["2026-11-07"], perfect: true });
    // Studied after the miss, but short of the double bar: the old streak goes and that day starts a new one.
    expect(run("2026-11-02", "xxx...x..")).toMatchObject({ current: 1, best: 3, breaks: ["2026-11-07"], earnBack: { missed: "2026-11-09" } });
  });
  it("can't be paid twice with the same work", () => {
    expect(run("2026-11-02", "xxx....D").earnBack?.missed).toBe("2026-11-08");
    expect(run("2026-11-02", "xxx....Dx.")).toMatchObject({ breaks: ["2026-11-08"] });
    expect(run("2026-11-02", "xxx....DD")).toMatchObject({ current: 5, earnBack: null, breaks: [] });
  });
});

describe("missed days", () => {
  it("run to 3, frozen ones included", () => expect(run("2026-11-02", "x...h").missedRun).toBe(3));
  it("skip rest days and end when a day counts", () => {
    const weekdays = new StudySchedule([{ from: "2026-01-01", timeZone: "Asia/Dubai", days: [1, 2, 3, 4, 5] }]);
    expect(run("2026-11-05", "x.....", weekdays).missedRun).toBe(2);
    expect(run("2026-11-02", "x...x").missedRun).toBe(0);
  });
  it("don't count from before the plan", () => expect(run("2026-11-02", "x.....", every, "2026-11-06").missedRun).toBe(1));
});
