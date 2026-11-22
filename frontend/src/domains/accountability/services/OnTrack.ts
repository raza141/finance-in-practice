import type { Mark } from "../types";

export type Band = "on_track" | "slipping" | "at_risk";

export interface OnTrackState {
  score: number;
  band: Band;
  hoursRatio: number;
  coverageRatio: number;
  /** Weighted by difficulty; null: no answers in the 14 days. */
  accuracy: number | null;
}

/**
 * F2: the On-Track score. Pure, and the one place its weights live.
 *
 *   on_track = 100 × (0.5 × hours + 0.3 × coverage + 0.2 × accuracy factor)
 *
 * Hours and coverage are measured against where the plan should be today, each capped at 1 so being ahead on
 * one can't hide the other. Green also needs 55% accuracy and 60% coverage.
 */
export class OnTrack {
  static readonly WEIGHTS = { hours: 0.5, coverage: 0.3, accuracy: 0.2 } as const;
  static readonly RATIO_CAP = 1;
  static readonly ACCURACY_TARGET = 0.7;
  static readonly FACTOR = { min: 0.5, max: 1.1 } as const;
  static readonly GREEN = 80;
  static readonly AMBER = 60;
  static readonly GREEN_NEEDS = { accuracy: 0.55, coverage: 0.6 } as const;
  static readonly DIFFICULTY = { easy: 0.8, "": 1, medium: 1, hard: 1.2 } as const;

  static score(input: {
    hoursDone: number;
    targetHours: number;
    elapsed: number;
    total: number;
    chapters: { touched: number; total: number };
    marks: readonly Mark[];
  }): OnTrackState {
    const { WEIGHTS: w, GREEN_NEEDS: needs, FACTOR } = OnTrack;
    const share = input.total > 0 ? input.elapsed / input.total : 0;
    const hoursRatio = OnTrack.ratio(input.hoursDone, input.targetHours * share);
    const coverageRatio = OnTrack.ratio(input.chapters.touched, input.chapters.total * share);
    const accuracy = OnTrack.accuracy(input.marks);
    const factor = accuracy === null ? FACTOR.min : Math.min(FACTOR.max, Math.max(FACTOR.min, accuracy / OnTrack.ACCURACY_TARGET));
    const raw = Math.round(100 * Math.min(1, w.hours * hoursRatio + w.coverage * coverageRatio + w.accuracy * factor));
    const greenAllowed = accuracy !== null && accuracy >= needs.accuracy && coverageRatio >= needs.coverage;
    const score = greenAllowed ? raw : Math.min(raw, OnTrack.GREEN - 1);
    return { score, band: OnTrack.band(score), hoursRatio, coverageRatio, accuracy };
  }

  static band(score: number): Band {
    return score >= OnTrack.GREEN ? "on_track" : score >= OnTrack.AMBER ? "slipping" : "at_risk";
  }

  /** Nothing expected yet (first day, no chapters) counts as on plan, not a division by zero. */
  private static ratio(done: number, expected: number): number {
    return expected > 0 ? Math.min(OnTrack.RATIO_CAP, done / expected) : 1;
  }

  /** Easy 0.8, medium or untagged 1, hard 1.2, over questions answered; capped at 100%. Null: none answered. */
  static accuracy(marks: readonly Mark[]): number | null {
    let total = 0;
    let credit = 0;
    for (const m of marks) {
      total += m.total;
      credit += m.correct * OnTrack.DIFFICULTY[m.difficulty];
    }
    return total ? Math.min(1, credit / total) : null;
  }

  /** Plain share right: what the tutor reads. */
  static plainAccuracy(marks: readonly Mark[]): number | null {
    const total = marks.reduce((sum, m) => sum + m.total, 0);
    return total ? marks.reduce((sum, m) => sum + m.correct, 0) / total : null;
  }
}
