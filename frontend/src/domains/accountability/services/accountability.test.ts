import { describe, expect, it, vi } from "vitest";

import { AdminNavigation } from "@/domains/admin/services/AdminNavigation";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import type { StudyFacts } from "../types";
import { CheckInEmail } from "./CheckInEmail";
import { LoopMetrics } from "./LoopMetrics";
import { StudyProgress } from "./StudyProgress";
import { TutorBoard } from "./TutorBoard";

const NOW = new Date("2026-11-22T08:00:00Z");
const day = (offset: number) => ZonedCalendar.addDays("2026-11-22", offset);
/** A student on plan: studied every one of the last ten days, today included. */
function student(name: string, over: { goal?: Partial<StudyFacts["goal"]>; studied?: number[]; hours?: number } = {}) {
  const studied = over.studied ?? [-9, -8, -7, -6, -5, -4, -3, -2, -1, 0];
  const facts: StudyFacts = {
    goal: {
      clientId: name,
      name,
      email: `${name}@example.test`,
      hideCountdown: false,
      live: true,
      course: "CFA Level I",
      level: 1,
      examOn: day(80),
      startedOn: day(-20),
      createdOn: day(-20),
      targetHours: 300,
      hoursPerDay: 4,
      priorMinutes: (over.hours ?? 70) * 60,
      ...over.goal,
    },
    schedule: [{ from: day(-20), timeZone: "Asia/Dubai", days: [1, 2, 3, 4, 5, 6, 7] }],
    days: studied.map((d) => ({ date: day(d), questions: 25, minutes: 30 })),
    goalMinutes: studied.map((d) => ({ date: day(d), minutes: 30 })),
    marks: [{ difficulty: "medium", correct: 75, total: 100 }],
    chapters: { touched: 20, total: 80 },
    weakest: [{ name: "Swaps", correct: 1, total: 4 }],
    mockScores: [61, 68],
  };
  return StudyProgress.of(facts, NOW);
}

describe("TutorBoard", () => {
  it("doesn't flag a student on plan", () => expect(TutorBoard.flags(student("Fine"))).toEqual([]));
  it("flags three planned days missed in a row, and not two", () => {
    expect(TutorBoard.flags(student("Three", { studied: [-6, -5, -4] }))).toContain("3 study days missed");
    expect(TutorBoard.flags(student("Two", { studied: [-5, -4, -3] }))).toEqual([]);
  });
  it("flags a score under 60", () => expect(TutorBoard.flags(student("Low", { hours: 0 }))).toEqual(["Score under 60"]));
  it("sorts by risk and leaves out closed and finished plans", () => {
    const rows = TutorBoard.rows([
      student("Fine"),
      student("Closed", { goal: { live: false } }),
      student("Three", { studied: [-6, -5, -4] }),
      student("Sat", { goal: { examOn: day(-1) } }),
      student("Low", { hours: 0 }),
      student("New", { goal: { startedOn: day(0), createdOn: day(0) } }),
    ]);
    expect(rows.map((r) => r.progress.goal.name)).toEqual(["Low", "Three", "Fine", "New"]);
  });
  it("is in the owner's menu only", () => {
    const menu = (role: "owner" | "editor" | "qa") => new AdminNavigation().all(role).some((m) => m.href === "/admin/accountability");
    expect([menu("owner"), menu("editor"), menu("qa")]).toEqual([true, false, false]);
  });
});

describe("StudyProgress", () => {
  it("scores nothing on the first day or after the exam", () => {
    expect(student("New", { goal: { startedOn: day(0) } }).onTrack).toBeNull();
    expect(student("Sat", { goal: { examOn: day(-1) } }).onTrack).toBeNull();
  });
});

describe("LoopMetrics", () => {
  it("counts drop-outs, and only windows that have closed", () => {
    const m = LoopMetrics.of([student("Fine"), student("Gone", { studied: [-19], goal: { live: false } })]);
    expect(m.streak7).toEqual({ count: 1, of: 1 });
    expect(m.d7).toEqual({ count: 1, of: 2 });
    expect(m.d30).toEqual({ count: 0, of: 0 });
    expect(m.returned).toEqual({ count: 0, of: 1 });
  });
});

describe("CheckInEmail", () => {
  it("drafts figures and one action, without blame", () => {
    const { body } = CheckInEmail.draft(student("Sara", { studied: [-6, -5, -4] }));
    expect(body.match(/One thing for this week/g)).toHaveLength(1);
    expect(body).toContain("On-Track score:");
    expect(body).not.toMatch(/miss|fail|at risk|behind/i);
  });
  it("escapes what the tutor typed and keeps the subject to one line", () => {
    const form = new FormData();
    form.set("subject", "Week\r\nBcc: x@example.test");
    form.set("body", "Hi <script>x</script>");
    const parsed = CheckInEmail.parse(form);
    if (!parsed.ok) throw new Error(parsed.error);
    const message = CheckInEmail.message(parsed.value);
    expect(message.subject).not.toContain("\n");
    expect(message.html).not.toContain("<script>");
  });
});

const ids = vi.hoisted(() => ({ facts: vi.fn(async () => []), addLog: vi.fn(), removeLog: vi.fn(async () => false), send: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/domains/students/server/StudentAuth", () => ({ StudentAuth: { current: async () => ({ id: "session-student" }) } }));
vi.mock("@/domains/admin/server/AdminAuth", () => ({
  AdminAuth: {
    requireOwner: async () => {
      throw new Error("NEXT_REDIRECT");
    },
  },
}));
vi.mock("../server/AccountabilityRepository", () => ({ AccountabilityRepository: { fromEnv: () => ids } }));

describe("actions", () => {
  it("only ever act on the signed-in student, whatever the form says", async () => {
    const { logStudyTime, removeStudyTime } = await import("../actions/study");
    const form = new FormData();
    form.set("clientId", "someone-else");
    form.set("id", "entry");
    await logStudyTime(null, form);
    await removeStudyTime(form);
    expect(ids.facts).toHaveBeenLastCalledWith("session-student");
    expect(ids.removeLog).toHaveBeenLastCalledWith("session-student", "entry");
    expect(ids.addLog).not.toHaveBeenCalled();
  });
  it("won't send a check-in, or read the student, for anyone but the owner", async () => {
    const { sendCheckIn } = await import("../actions/checkIn");
    ids.facts.mockClear();
    await expect(sendCheckIn("someone", null, new FormData())).rejects.toThrow("NEXT_REDIRECT");
    expect(ids.facts).not.toHaveBeenCalled();
  });
});
