import { describe, expect, it } from "vitest";

import type { ClassItem } from "../types";
import { WeeklyEmail } from "./WeeklyEmail";

const item = (over: Partial<ClassItem>): ClassItem => ({
  id: "x",
  classTitle: "CFA Level I",
  kind: "assignment",
  title: "Homework",
  text: "",
  link: null,
  postedAt: "2026-10-14T10:00:00Z",
  dueAt: null,
  topic: null,
  status: null,
  late: false,
  grade: null,
  gradedAt: null,
  topicOrder: null,
  mock: false,
  files: [],
  ...over,
});
const empty = { due: [], missing: [], fresh: [], marks: [] };

describe("WeeklyEmail", () => {
  it("says nothing when the week is empty", () => {
    expect(WeeklyEmail.build("Sara Khan", empty, "https://p", "https://u")).toBeNull();
  });

  it("lists due, missing, marks and new, escapes titles and links to the portal and unsubscribe", () => {
    const m = WeeklyEmail.build(
      "Sara Khan",
      {
        due: [item({ id: "d", title: "Quiz <b>3</b>", dueAt: "2026-10-18T16:00:00Z", status: "todo" })],
        missing: [item({ id: "m", title: "TVM homework", status: "missing" })],
        fresh: [item({ id: "n", kind: "material", title: "FRA notes" })],
        marks: [item({ id: "g", title: "Mock 4", grade: { points: 62, max: 100 } })],
      },
      "https://financeinpractice.me/student",
      "https://financeinpractice.me/student/weekly-email?t=abc",
    )!;
    expect(m.subject).toBe("Your week in class: 1 due · 1 missing · 1 new");
    expect(m.html).toContain("Hi Sara");
    expect(m.html).toContain("Quiz &lt;b&gt;3&lt;/b&gt;");
    expect(m.html).not.toContain("<b>3</b>");
    expect(m.html).toContain("Due Sun 18 Oct, 20:00");
    expect(m.html).toContain("62/100 · 62%");
    expect(m.html).toContain("Material · CFA Level I");
    expect(m.html).toContain("https://financeinpractice.me/student/weekly-email?t=abc");
    expect(m.text).toContain("Open your portal: https://financeinpractice.me/student");
  });
});
