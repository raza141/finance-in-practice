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
