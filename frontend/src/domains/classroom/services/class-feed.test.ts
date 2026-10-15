import { describe, expect, it } from "vitest";

import type { GCourseData } from "../types";
import { ClassFeed } from "./ClassFeed";

const NOW = Date.UTC(2026, 9, 15, 12);
const COURSES = [
  { id: "1", name: "CFA L1", alternateLink: "https://classroom.google.com/c/NzQ5MDA", enrollmentCode: "abc123" },
  { id: "2", name: "FRM", alternateLink: "https://classroom.google.com/c/ODIxMjM", enrollmentCode: "xyz789" },
];

const data: GCourseData = {
  topics: [
    { topicId: "t1", name: "Mock exams" },
    { topicId: "t2", name: "Ethics" },
  ],
  work: [
    { id: "m1", title: "Mock 1", maxPoints: 50, topicId: "t1", creationTime: "2026-09-01T10:00:00Z", dueDate: { year: 2026, month: 9, day: 5 }, materials: [{ form: { formUrl: "https://docs.google.com/forms/d/x", title: "Mock 1" } }] },
    { id: "m2", title: "Mock 2", maxPoints: 100, topicId: "t1", creationTime: "2026-10-01T10:00:00Z", dueDate: { year: 2026, month: 10, day: 5 }, dueTime: { hours: 8 } },
    { id: "e1", title: "Ethics quiz", maxPoints: 10, topicId: "t2", creationTime: "2026-10-10T10:00:00Z" },
    { id: "hw", title: "Homework", creationTime: "2026-10-12T10:00:00Z", dueDate: { year: 2026, month: 10, day: 14 } },
    { id: "soon", title: "Due soon", creationTime: "2026-10-14T10:00:00Z", dueDate: { year: 2026, month: 10, day: 18 } },
    { id: "solo", title: "Just for Sara", assigneeMode: "INDIVIDUAL_STUDENTS", individualStudentsOptions: { studentIds: ["u-sara"] } },
  ],
  materials: [{ id: "f1", title: "FRA notes", creationTime: "2026-10-13T10:00:00Z", materials: [{ driveFile: { driveFile: { title: "FRA.pdf", alternateLink: "https://drive.google.com/file/d/1" } } }] }],
  announcements: [{ id: "a1", text: "Class moved\nWe meet on Sunday instead.", creationTime: "2026-10-14T09:00:00Z" }],
};
const subs = [
  { courseWorkId: "m1", userId: "u-ali", state: "RETURNED" as const, assignedGrade: 25 },
  { courseWorkId: "m2", userId: "u-ali", state: "RETURNED" as const, assignedGrade: 72, updateTime: "2026-10-12T09:00:00Z" },
  { courseWorkId: "e1", userId: "u-ali", state: "RETURNED" as const, assignedGrade: 6 },
  { courseWorkId: "hw", userId: "u-ali", state: "CREATED" as const },
  { courseWorkId: "soon", userId: "u-ali", state: "NEW" as const },
  { courseWorkId: "m1", userId: "u-sara", state: "RETURNED" as const, assignedGrade: 50 },
];

describe("ClassFeed", () => {
  it("matches a stored link by class id or join code", () => {
    expect(ClassFeed.match("https://classroom.google.com/c/NzQ5MDA?cjc=zzz", COURSES)?.id).toBe("1");
    expect(ClassFeed.match("https://classroom.google.com/u/0/c/ODIxMjM", COURSES)?.id).toBe("2");
    expect(ClassFeed.match("https://classroom.google.com/?cjc=xyz789", COURSES)?.id).toBe("2");
    expect(ClassFeed.match("https://classroom.google.com/c/OTHER", COURSES)).toBeNull();
    expect(ClassFeed.match("not a url", COURSES)).toBeNull();
  });

  it("shows only the student's own work, with statuses and returned grades", () => {
    const items = ClassFeed.items("CFA Level I", data, "u-ali", subs, NOW);
    const by = (id: string) => items.find((i) => i.id === id);
    expect(by("solo")).toBeUndefined();
    expect(by("m1")).toMatchObject({ kind: "quiz", mock: true, status: "returned", grade: { points: 25, max: 50 }, files: [] });
    expect(by("hw")?.status).toBe("missing");
    expect(by("soon")?.status).toBe("todo");
    expect(by("f1")).toMatchObject({ kind: "material", files: [{ title: "FRA.pdf", url: "https://drive.google.com/file/d/1" }] });
    expect(by("a1")).toMatchObject({ kind: "announcement", title: "Class moved", text: "We meet on Sunday instead." });
    expect(items[0].id).toBe("soon");
    expect(ClassFeed.dueAt(data.work[1])).toBe("2026-10-05T08:00:00.000Z");
    expect(ClassFeed.dueAt(data.work[0])).toBe("2026-09-05T23:59:00.000Z");
  });

  it("without a Classroom id: shared posts only, no statuses", () => {
    const items = ClassFeed.items("CFA Level I", data, null, subs, NOW);
    expect(items.find((i) => i.id === "solo")).toBeUndefined();
    expect(items.every((i) => i.status === null && i.grade === null)).toBe(true);
  });

  it("works out to-do, due soon, new and progress", () => {
    const items = ClassFeed.items("CFA Level I", data, "u-ali", subs, NOW);
    expect(ClassFeed.todo(items).map((i) => i.id)).toEqual(["hw", "soon"]);
    expect(ClassFeed.dueWithin(items, 7, NOW).map((i) => i.id)).toEqual(["soon"]);
    expect(items.filter((i) => ClassFeed.isNew(i, "2026-10-13T12:00:00Z", NOW)).map((i) => i.id)).toEqual(["soon", "a1"]);
    const p = ClassFeed.progress(items);
    expect(p.mocks.map((m) => m.pct)).toEqual([50, 72]);
    expect(p).toMatchObject({ latest: 72, average: 61, best: 72, change: 22 });
    // Every mark counts, by topic in Classroom's order: mocks (t1) then Ethics (t2).
    expect(p.topics.map((t) => [t.name, t.pct, t.count])).toEqual([["Mock exams", 61, 2], ["Ethics", 60, 1]]);
    expect(p.overall).toMatchObject({ last: { id: "e1", pct: 60 }, average: 60.7, best: 72, count: 3 });
    const week = ClassFeed.week(items, NOW);
    expect(week.due.map((i) => i.id)).toEqual(["soon"]);
    expect(week.missing.map((i) => i.id)).toEqual(["hw"]);
    expect(week.fresh.map((i) => i.id)).toEqual(["soon", "a1", "f1", "hw", "e1"]);
    expect(week.marks.map((i) => i.id)).toEqual(["m2"]);
    expect(ClassFeed.progress([])).toMatchObject({ mocks: [], latest: null, average: null, change: null });
  });

  it("groups every post by topic in Classroom's order, with no cap", () => {
    const books = Array.from({ length: 10 }, (_, b) => ({ topicId: `b${b + 1}`, name: `Book ${b + 1}` }));
    const library: GCourseData = {
      topics: books,
      work: [{ id: "only-sara", title: "Sara's file", topicId: "b2", assigneeMode: "INDIVIDUAL_STUDENTS", individualStudentsOptions: { studentIds: ["u-sara"] } }],
      materials: Array.from({ length: 70 }, (_, i) => ({ id: `f${i}`, title: `File ${i}`, topicId: `b${(i % 10) + 1}`, creationTime: new Date(NOW - i * 3_600_000).toISOString() })),
      announcements: [{ id: "a1", text: "Welcome", creationTime: "2026-10-14T09:00:00Z" }],
    };
    const groups = ClassFeed.byTopic(ClassFeed.items("CFA Level I", library, "u-ali", [], NOW));
    expect(groups.map((g) => g.topic)).toEqual([...books.map((b) => b.name), "Other"]);
    expect(groups.slice(0, 10).every((g) => g.items.length === 7)).toBe(true);
    expect(groups.flatMap((g) => g.items).some((i) => i.id === "only-sara")).toBe(false);
    expect(ClassFeed.byTopic(ClassFeed.items("CFA Level I", library, "u-sara", [], NOW))[1].items.map((i) => i.id)).toContain("only-sara");
  });
});
