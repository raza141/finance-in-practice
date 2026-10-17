import { describe, expect, it } from "vitest";

import { WhatsAppScanner } from "../server/WhatsAppScanner";
import { WhatsAppText } from "./WhatsAppText";

const HOUR = 3_600_000;

describe("WhatsAppText", () => {
  it("normalises phone numbers and refuses unusable ones", () => {
    expect(WhatsAppText.phone("+971 50 230 4045")).toBe("971502304045");
    expect(WhatsAppText.phone("050 230 4045")).toBe("971502304045");
    expect(WhatsAppText.phone("123")).toBe("");
  });

  it("is quiet 22:00–08:00 Dubai time", () => {
    expect(WhatsAppText.isQuiet(new Date("2026-10-18T18:30:00Z"))).toBe(true); // 22:30 Dubai
    expect(WhatsAppText.isQuiet(new Date("2026-10-18T03:59:00Z"))).toBe(true); // 07:59
    expect(WhatsAppText.isQuiet(new Date("2026-10-18T04:00:00Z"))).toBe(false); // 08:00
  });

  it("plans reminders only when the booking was made well ahead", () => {
    const start = new Date("2026-10-21T15:00:00Z");
    expect(WhatsAppText.reminders(start, new Date(start.getTime() - 3 * 24 * HOUR)).map((p) => p.key)).toEqual(["r24", "r1"]);
    expect(WhatsAppText.reminders(start, new Date(start.getTime() - 5 * HOUR)).map((p) => p.key)).toEqual(["r1"]);
    expect(WhatsAppText.reminders(start, new Date(start.getTime() - HOUR))).toEqual([]);
    const [, r1] = WhatsAppText.reminders(start, new Date(start.getTime() - 3 * 24 * HOUR));
    expect(r1.quietOk).toBe(true);
    expect(r1.notBefore.getTime()).toBe(start.getTime() - HOUR);
  });

  it("calls an invoice overdue 5 days after its due date", () => {
    expect(WhatsAppText.isOverdue("2026-10-10", "2026-10-14")).toBe(false);
    expect(WhatsAppText.isOverdue("2026-10-10", "2026-10-15")).toBe(true);
  });

  it("reads STOP and START replies", () => {
    expect(WhatsAppText.command(" stop ")).toBe("stop");
    expect(WhatsAppText.command("Start!")).toBe("start");
    expect(WhatsAppText.command("stop sending me the mock")).toBeNull();
  });

  it("personalises the class-post template", () => {
    const text = WhatsAppText.personal(WhatsAppText.classPost("mock", "CFA Level I · Nov 2026", "Mock 3", null, "https://classroom.google.com/x"), "Sara Khan");
    expect(text).toContain("Hi Sara, New mock exam in CFA Level I · Nov 2026:");
    expect(text).not.toContain("{name}");
  });
});

describe("WhatsAppScanner.posts", () => {
  it("marks work under a mock topic as a mock and keeps individual assignees", () => {
    const posts = WhatsAppScanner.posts({
      topics: [{ topicId: "t1", name: "Mock exams" }],
      work: [
        { id: "w1", title: "Mock 3", topicId: "t1", assigneeMode: "INDIVIDUAL_STUDENTS", individualStudentsOptions: { studentIds: ["u-sara"] } },
        { id: "w2", title: "FSA set", dueDate: { year: 2026, month: 10, day: 25 }, dueTime: { hours: 20 } },
      ],
      materials: [{ id: "m1", title: "Slides" }],
      announcements: [{ id: "a1", text: "Class moved\nto Thursday" }],
    });
    expect(posts.map((p) => [p.id, p.kind, p.title])).toEqual([
      ["w1", "mock", "Mock 3"],
      ["w2", "assignment", "FSA set"],
      ["m1", "material", "Slides"],
      ["a1", "announcement", "Class moved"],
    ]);
    expect(posts[0].studentIds).toEqual(["u-sara"]);
    expect(posts[1].dueAt?.toISOString()).toBe("2026-10-25T20:00:00.000Z");
  });
});
