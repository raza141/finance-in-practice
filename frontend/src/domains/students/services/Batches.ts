import { ExamFacts, type ExamWindow } from "@/domains/courses/services/ExamFacts";
import type { Ticker } from "@/domains/testimonials/types";

/** A batch the owner opened (043_batches): one Google class per course and sitting. */
export interface OpenedBatch {
  label: string;
  /** yyyy-mm-dd, approximate: orders batches and hides them once the exam has passed. */
  examDate: string;
}

/**
 * Exam courses (those with sittings in ExamFacts: CFA L1/L2, FRM) run one class
 * per sitting. Pure: decides which sittings a student or the owner may pick.
 */
export class Batches {
  static readonly NOT_SURE = "Not sure yet";
  static readonly OFFER = 3;

  /** The course's sittings, or null: not an exam course, so no batches (one course class or private classes). */
  static windows(ticker: Ticker | null): ExamWindow[] | null {
    return ExamFacts.for(ticker)?.windows ?? null;
  }

  /**
   * What a registering student sees: batches already opened whose exam is still
   * ahead (a running class can be joined late), then the next sittings they can
   * still prepare for; soonest first, up to three.
   */
  static offer(windows: readonly ExamWindow[], opened: readonly OpenedBatch[], now: Date): string[] {
    const today = now.toISOString().slice(0, 10);
    const running = opened.filter((b) => b.examDate >= today).map((b) => ({ label: b.label, date: b.examDate }));
    const next = ExamFacts.nextWindows({ facts: [], windows: [...windows] }, now, windows.length).map((w) => ({ label: w.label, date: w.starts }));
    return Batches.sorted([...running, ...next]).slice(0, Batches.OFFER);
  }

  /** What the owner may assign: every opened batch (past ones too, for the record) and every sitting still ahead. */
  static assignable(windows: readonly ExamWindow[], opened: readonly OpenedBatch[], now: Date): string[] {
    const today = now.toISOString().slice(0, 10);
    const ahead = windows.filter((w) => w.starts >= today).map((w) => ({ label: w.label, date: w.starts }));
    return Batches.sorted([...opened.map((b) => ({ label: b.label, date: b.examDate })), ...ahead]);
  }

  /** The owner's "new student" email line: what to do about their batch. */
  static noticeRow(batch: string, state: "ready" | "no-class" | "not-sure"): [string, string] {
    if (state === "not-sure") return ["Batch", "Not sure yet: set their batch on their client page."];
    if (state === "no-class") return ["Batch", `${batch} · NO CLASS YET: create it in Google Classroom, then add its link in Admin → Classroom → Batches.`];
    return ["Batch", `${batch} · class ready: approve their request when it comes.`];
  }

  private static sorted(items: { label: string; date: string }[]): string[] {
    const first = new Map<string, string>();
    for (const i of items) if (!first.has(i.label) || i.date < first.get(i.label)!) first.set(i.label, i.date);
    return [...first].sort(([, a], [, b]) => a.localeCompare(b)).map(([label]) => label);
  }
}
