import type { AttemptSummary } from "@/domains/mocks/types";

import type { StudentSession, StudyPlanItem } from "../types";

/** One thing on the study calendar. Plain strings only: it crosses into a client component. */
export type StudyDayItem =
  | {
      kind: "topic";
      id: string;
      date: string;
      dueOn: string;
      topic: string;
      status: StudyPlanItem["status"];
      note: string;
      materialUrl: string | null;
      /** Still planned and its date has passed: shown on today until it's moved or done. */
      carried: boolean;
      /** The bank topic a topic test draws from; null: none matches. */
      test: string | null;
      /** First day of a range (072); "" for a one-day topic. */
      startOn: string;
      /** Where this day sits in a range: the calendar draws one band across the days. */
      span: "one" | "start" | "mid" | "end";
      /** A scheduled mock; open: the student can start it now (else the start page would 404). */
      mock: { id: string; open: boolean } | null;
      /** When the student last moved or ticked it: admin shows it. */
      studentChangedAt: string | null;
    }
  | { kind: "session"; id: string; date: string; time: string; course: string; place: string; meetingUrl: string | null; pending: boolean }
  | { kind: "mock"; id: string; date: string; title: string; percent: number }
  | { kind: "exam"; id: string; date: string; course: string; days: number };

export type StudyTopic = Extract<StudyDayItem, { kind: "topic" }>;

const ZONE = "Asia/Dubai";
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE });
const TIME = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "numeric", minute: "2-digit", hour12: true });
const ORDER: Record<StudyDayItem["kind"], number> = { exam: 0, session: 1, topic: 2, mock: 3 };

/** The study calendar: plan topics, sessions, finished mocks and exam day, by day in UAE time. */
export class StudyDays {
  static today(now: Date = new Date()): string {
    return DAY.format(now);
  }

  static build(input: {
    items: readonly StudyPlanItem[];
    sessions: readonly StudentSession[];
    attempts: readonly AttemptSummary[];
    exam: { course: string; date: string } | null;
    bankTopics: readonly string[];
    /** Mocks open to this student: a scheduled one shows Start only if it's here. */
    openMocks?: readonly string[];
    /** Admin: every undated item in Unscheduled (done and skipped too), so each one can still be opened. */
    allUndated?: boolean;
    today: string;
  }): { days: Record<string, StudyDayItem[]>; unscheduled: StudyTopic[] } {
    const { today } = input;
    const all: StudyDayItem[] = [];
    const unscheduled: StudyTopic[] = [];
    const finished = new Set(input.attempts.filter((a) => a.status === "completed").map((a) => a.mockId));
    for (const raw of input.items) {
      // A scheduled mock ticks itself once it's finished; its score then shows on the day it was taken.
      const i = raw.mockId && raw.status === "planned" && finished.has(raw.mockId) ? { ...raw, status: "done" as const } : raw;
      const carried = StudyDays.overdue(i, today);
      const topic: StudyTopic = {
        kind: "topic",
        id: i.id,
        date: carried ? today : (i.dueOn ?? ""),
        dueOn: i.dueOn ?? "",
        topic: i.topic,
        status: i.status,
        note: i.note,
        materialUrl: i.materialUrl,
        carried,
        test: StudyDays.match(i.topic, input.bankTopics),
        startOn: i.startOn ?? "",
        span: "one",
        mock: i.mockId ? { id: i.mockId, open: (input.openMocks ?? []).includes(i.mockId) } : null,
        studentChangedAt: i.studentChangedAt,
      };
      if (i.dueOn && i.startOn && !carried) {
        // ponytail: a copy per day of the range; fine for the month-or-two ranges a plan uses.
        const length = Math.min(StudyDays.days(i.startOn, i.dueOn), 400);
        for (let n = 0; n <= length; n++) all.push({ ...topic, date: StudyDays.addDays(i.startOn, n), span: n === 0 ? "start" : n === length ? "end" : "mid" });
      } else if (i.dueOn) all.push(topic);
      else if (i.status === "planned" || input.allUndated) unscheduled.push(topic);
    }
    for (const s of input.sessions) {
      const start = new Date(s.start);
      all.push({ kind: "session", id: s.uid, date: DAY.format(start), time: TIME.format(start), course: s.course, place: s.address ?? "Online", meetingUrl: s.meetingUrl, pending: s.status === "pending" });
    }
    for (const a of input.attempts) {
      if (a.status !== "completed" || !a.submittedAt || a.score === null || !a.total) continue;
      all.push({ kind: "mock", id: a.id, date: DAY.format(a.submittedAt), title: a.mistakes ? `${a.mockTitle}: mistakes` : a.mockTitle, percent: Math.round((a.score / a.total) * 100) });
    }
    if (input.exam) all.push({ kind: "exam", id: "exam", date: input.exam.date, course: input.exam.course, days: StudyDays.days(today, input.exam.date) });

    const days: Record<string, StudyDayItem[]> = {};
    for (const item of all) (days[item.date] ??= []).push(item);
    // Within a day: overdue first, then one-day topics, then range bands (oldest start first, so bands line up).
    const band = (x: StudyDayItem) => (x.kind === "topic" && x.startOn ? x.startOn : "");
    for (const list of Object.values(days))
      list.sort(
        (a, b) =>
          ORDER[a.kind] - ORDER[b.kind] ||
          Number(b.kind === "topic" && b.carried) - Number(a.kind === "topic" && a.carried) ||
          Number(band(a) !== "") - Number(band(b) !== "") ||
          band(a).localeCompare(band(b)),
      );
    return { days, unscheduled };
  }

  /** Still planned, and its date has passed. */
  static overdue(item: Pick<StudyPlanItem, "status" | "dueOn">, today: string): boolean {
    return item.status === "planned" && item.dueOn !== null && item.dueOn < today;
  }

  /** This week's target for Home: planned topics due today through the next six days, and how many are already overdue. */
  static week(items: readonly Pick<StudyPlanItem, "status" | "dueOn">[], today: string): { due: number; behind: number } {
    const end = StudyDays.addDays(today, 6);
    let due = 0;
    let behind = 0;
    for (const i of items) {
      if (StudyDays.overdue(i, today)) behind++;
      else if (i.status === "planned" && i.dueOn !== null && i.dueOn <= end) due++;
    }
    return { due, behind };
  }

  /** `month` (yyyy-mm) as weeks of seven yyyy-mm-dd, Monday first, padded with the days around it. */
  static monthGrid(month: string): string[][] {
    const first = `${month}-01`;
    const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
    let day = StudyDays.addDays(first, -weekday);
    const weeks: string[][] = [];
    do {
      weeks.push(Array.from({ length: 7 }, (_, i) => StudyDays.addDays(day, i)));
      day = StudyDays.addDays(day, 7);
    } while (day.slice(0, 7) === month);
    return weeks;
  }

  static shiftMonth(month: string, by: number): string {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    return d.toISOString().slice(0, 7);
  }

  /** The bank topic a plan topic is about ("Ethics & Professional Standards" → "Ethics"): the longest name either contains. */
  static match(topic: string, bankTopics: readonly string[]): string | null {
    const t = topic.trim().toLowerCase();
    if (!t) return null;
    const hits = bankTopics.filter((b) => {
      const name = b.trim().toLowerCase();
      return name.length > 0 && (t.includes(name) || name.includes(t));
    });
    return hits.toSorted((a, b) => b.length - a.length)[0] ?? null;
  }

  static addDays(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  }

  static days(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  }
}
