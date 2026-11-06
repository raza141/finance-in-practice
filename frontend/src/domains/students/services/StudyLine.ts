import type { StudyPlanItem } from "../types";

export type StudyLineNode =
  | { kind: "topic"; id: string; date: string; topic: string; status: StudyPlanItem["status"]; next: boolean }
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
      .map((i) => ({ kind: "topic", id: i.id, date: i.dueOn, topic: i.topic, status: i.status, next: i === next }));
    if (exam) nodes.push({ kind: "exam", date: exam.date, course: exam.course, days: StudyLine.days(today, exam.date) });
    if (nodes.length === 0) return [];
    // Today sits before the first thing still ahead; on a topic's own day it comes first.
    const at = nodes.findIndex((n) => n.date >= today);
    nodes.splice(at === -1 ? nodes.length : at, 0, { kind: "today", date: today });
    return nodes;
  }

  static days(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  }
}
