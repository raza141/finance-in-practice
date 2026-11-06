import type { StudyPlanItem } from "../types";

export type StudyLineNode =
  | { kind: "topic"; id: string; date: string; topic: string; status: StudyPlanItem["status"]; next: boolean; overdue: boolean }
  | { kind: "today"; date: string }
  | { kind: "exam"; date: string; course: string; days: number };

/**
 * The study plan as one line to exam day: dated topics in order, "today" where it falls, the exam last.
 * Nodes are spaced evenly (not by date), so labels never collide. Undated topics stay off the line.
 */
export class StudyLine {
  static build(items: readonly StudyPlanItem[], exam: { course: string; date: string } | null, today: string): StudyLineNode[] {
    const next = items.find((i) => i.status === "planned");
    const nodes: StudyLineNode[] = items
      .filter((i): i is StudyPlanItem & { dueOn: string } => i.dueOn !== null)
      .toSorted((a, b) => a.dueOn.localeCompare(b.dueOn))
      .map((i) => ({ kind: "topic", id: i.id, date: i.dueOn, topic: i.topic, status: i.status, next: i === next, overdue: StudyLine.overdue(i, today) }));
    if (exam) nodes.push({ kind: "exam", date: exam.date, course: exam.course, days: StudyLine.days(today, exam.date) });
    if (nodes.length === 0) return [];
    // Today sits before the first thing still ahead; on a topic's own day it comes first.
    const at = nodes.findIndex((n) => n.date >= today);
    nodes.splice(at === -1 ? nodes.length : at, 0, { kind: "today", date: today });
    return nodes;
  }

  /** Still planned, and its date has passed. */
  static overdue(item: StudyPlanItem, today: string): boolean {
    return item.status === "planned" && item.dueOn !== null && item.dueOn < today;
  }

  /** Days kept free for revision before the exam when re-planning, if there's room. */
  static readonly REVISION_DAYS = 7;

  /**
   * New dates for every unfinished topic (in plan order, unscheduled last), spread evenly from tomorrow
   * to a week before the exam; to the day before it when that's too tight. Done and skipped topics keep theirs.
   */
  static replan(items: readonly StudyPlanItem[], today: string, examDate: string): { id: string; dueOn: string }[] {
    const todo = items.filter((i) => i.status === "planned").toSorted((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"));
    const start = StudyLine.addDays(today, 1);
    let end = StudyLine.addDays(examDate, -StudyLine.REVISION_DAYS);
    if (end <= start) end = StudyLine.addDays(examDate, -1);
    if (end < start) end = start;
    const span = StudyLine.days(start, end);
    return todo.map((item, i) => ({ id: item.id, dueOn: StudyLine.addDays(start, todo.length < 2 ? 0 : Math.round((span * i) / (todo.length - 1))) }));
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
