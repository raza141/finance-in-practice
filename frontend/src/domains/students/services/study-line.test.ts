import { describe, expect, it } from "vitest";

import type { StudyPlanItem } from "../types";
import { StudyLine } from "./StudyLine";

const item = (id: string, dueOn: string | null, status: StudyPlanItem["status"] = "planned"): StudyPlanItem => ({ id, dueOn, topic: id, status, note: "", materialUrl: null });

describe("StudyLine.build", () => {
  it("puts dated topics in order, today where it falls, the exam last, and leaves undated topics off", () => {
    const line = StudyLine.build([item("quant", "2026-10-20", "done"), item("fsa", "2026-11-10"), item("later", null), item("ethics", "2026-11-01", "done")], { course: "CFA Level I", date: "2026-11-17" }, "2026-11-07");
    expect(line.map((n) => (n.kind === "topic" ? n.topic : n.kind))).toEqual(["quant", "ethics", "today", "fsa", "exam"]);
    expect(line.find((n) => n.kind === "topic" && n.next)).toMatchObject({ topic: "fsa" });
    expect(line.at(-1)).toMatchObject({ kind: "exam", days: 10 });
  });

  it("ends at the last topic with no exam, and is empty with nothing dated", () => {
    expect(StudyLine.build([item("a", "2026-11-01", "done")], null, "2026-11-07").map((n) => n.kind)).toEqual(["topic", "today"]);
    expect(StudyLine.build([item("a", null)], null, "2026-11-07")).toEqual([]);
  });
});

describe("StudyLine catch-up", () => {
  it("marks planned topics past their date as overdue, never done or skipped ones", () => {
    const line = StudyLine.build([item("late", "2026-11-01"), item("done", "2026-11-01", "done"), item("skip", "2026-11-02", "skipped")], null, "2026-11-07");
    expect(line.filter((n) => n.kind === "topic" && n.overdue).map((n) => n.kind === "topic" && n.topic)).toEqual(["late"]);
  });

  it("re-plans unfinished topics evenly from tomorrow to a week before the exam, unscheduled last", () => {
    const items = [item("a", "2026-11-01"), item("b", null), item("done", "2026-11-02", "done"), item("c", "2026-11-03")];
    expect(StudyLine.replan(items, "2026-11-07", "2026-11-28")).toEqual([
      { id: "a", dueOn: "2026-11-08" },
      { id: "c", dueOn: "2026-11-15" },
      { id: "b", dueOn: "2026-11-21" },
    ]);
  });

  it("uses the days up to the exam when a week of revision doesn't fit", () => {
    expect(StudyLine.replan([item("a", "2026-11-01"), item("b", "2026-11-02")], "2026-11-07", "2026-11-11")).toEqual([
      { id: "a", dueOn: "2026-11-08" },
      { id: "b", dueOn: "2026-11-10" },
    ]);
  });

  it("matches a plan topic to the bank topic it's about", () => {
    const bank = ["Ethics", "Equity", "Fixed Income", "Quantitative Methods"];
    expect(StudyLine.match("Ethics & Professional Standards", bank)).toBe("Ethics");
    expect(StudyLine.match("fixed income", bank)).toBe("Fixed Income");
    expect(StudyLine.match("Quant", bank)).toBe("Quantitative Methods");
    expect(StudyLine.match("Mock exam 2", bank)).toBeNull();
  });
});
