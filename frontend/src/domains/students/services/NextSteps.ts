import type { Ticker } from "@/domains/testimonials/types";

import type { Student } from "../types";
import { Batches, type OpenedBatch } from "./Batches";

export interface CourseOption {
  title: string;
  ticker: Ticker | null;
}

export interface ExamResult {
  course: string;
  label: string;
  passed: boolean;
}

export interface CourseRequestRef {
  course: string;
  label: string;
  retake: boolean;
}

export interface NextStepInput {
  ended: Student["ended"];
  /** Live courses (student.courses). */
  live: readonly string[];
  /** Every course on the client, ended and paused included. */
  enrolled: readonly string[];
  /** Active courses, one per title. */
  courses: readonly CourseOption[];
  results: readonly ExamResult[];
  pending: readonly CourseRequestRef[];
  /** Opened batches by course title. */
  opened: Readonly<Record<string, readonly OpenedBatch[]>>;
  now: Date;
}

export type NextStep =
  | { kind: "result"; course: string; label: string }
  | { kind: "move"; course: string; retake: boolean; sittings: string[] }
  | { kind: "waiting"; course: string; label: string; retake: boolean };

/** A course a student may ask to add; `sittings` null: no exam sittings (1:1 or the course's own class). */
export interface AddableCourse {
  course: string;
  sittings: string[] | null;
}

/**
 * After a sitting: report the result, then move up a level or retake, with the same account.
 * Pure: the portal card, the "Add a course" page and the request action all read it, so the
 * action accepts only what the student was shown.
 */
export class NextSteps {
  /** The level a pass opens. CFA Level III and FRM Part II aren't offered yet. */
  static readonly NEXT: Partial<Record<Ticker, Ticker>> = { CFA1: "CFA2" };
  /** Retake package discount, in percent, pre-applied when the owner approves. */
  static readonly RETAKE_DISCOUNT = 10;
  private static readonly CFA: readonly Ticker[] = ["CFA1", "CFA2"];

  static steps(input: NextStepInput): NextStep[] {
    const ticker = (title: string) => input.courses.find((c) => c.title === title)?.ticker ?? null;
    const titleOf = (t: Ticker) => input.courses.find((c) => c.ticker === t)?.title ?? null;
    const pending = (course: string) => input.pending.some((p) => p.course === course);
    const steps: NextStep[] = [];
    for (const e of input.ended) {
      if (e.paused) continue;
      const t = ticker(e.course);
      const windows = Batches.windows(t);
      if (!windows) continue;
      const result = input.results.find((r) => r.course === e.course && r.label === e.label);
      if (!result) steps.push({ kind: "result", course: e.course, label: e.label });
      if (result && !result.passed && !pending(e.course)) {
        const opened = input.opened[e.course] ?? [];
        const sittings =
          t && NextSteps.CFA.includes(t) && e.examDate ? Batches.retake(windows, opened, e.examDate, input.now) : Batches.offer(windows, opened, input.now);
        steps.push({ kind: "move", course: e.course, retake: true, sittings });
      }
      const next = t && NextSteps.NEXT[t] ? titleOf(NextSteps.NEXT[t]) : null;
      // Before the result too: a confident student can start the next level early.
      if (next && result?.passed !== false && !input.live.includes(next) && !pending(next)) {
        steps.push({ kind: "move", course: next, retake: false, sittings: Batches.offer(Batches.windows(ticker(next)) ?? [], input.opened[next] ?? [], input.now) });
      }
    }
    for (const p of input.pending) steps.push({ kind: "waiting", course: p.course, label: p.label, retake: p.retake });
    return steps;
  }

  /** Active courses the student doesn't have and hasn't asked for. */
  static addable(input: NextStepInput): AddableCourse[] {
    return input.courses
      .filter((c) => !input.enrolled.includes(c.title) && !input.pending.some((p) => p.course === c.title))
      .map((c) => {
        const windows = Batches.windows(c.ticker);
        return { course: c.title, sittings: windows ? Batches.offer(windows, input.opened[c.title] ?? [], input.now) : null };
      });
  }

  /** True when this request is one the student was offered (card or "Add a course"). */
  static allowed(input: NextStepInput, ask: CourseRequestRef): boolean {
    const move = NextSteps.steps(input).some((s) => s.kind === "move" && s.course === ask.course && s.retake === ask.retake && s.sittings.includes(ask.label));
    if (move) return true;
    if (ask.retake) return false;
    const add = NextSteps.addable(input).find((a) => a.course === ask.course);
    return !!add && (add.sittings === null ? ask.label === "" : add.sittings.includes(ask.label));
  }

  /** The retake price: the package's, less the discount (minor units). */
  static retakePrice(packageMinor: number): number {
    return Math.round((packageMinor * (100 - NextSteps.RETAKE_DISCOUNT)) / 100);
  }
}
