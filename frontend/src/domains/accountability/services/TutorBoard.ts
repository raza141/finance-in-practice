import type { StudentProgress } from "./StudyProgress";
import { OnTrack } from "./OnTrack";

export interface BoardRow {
  progress: StudentProgress;
  /** Why they're flagged; empty: they aren't. */
  flags: string[];
}

/** F5: who needs the tutor first. Pure. */
export class TutorBoard {
  static readonly MISSED_FLAG = 3;

  static flags({ streak, onTrack }: Pick<StudentProgress, "streak" | "onTrack">): string[] {
    const flags: string[] = [];
    if (streak.missedRun >= TutorBoard.MISSED_FLAG) flags.push(`${streak.missedRun} study days missed`);
    if (onTrack && onTrack.score < OnTrack.AMBER) flags.push("Score under 60");
    return flags;
  }

  /** Open plans with the exam still ahead: flagged first, then the lowest score, then the most days missed. */
  static rows(all: readonly StudentProgress[]): BoardRow[] {
    const score = (r: BoardRow) => r.progress.onTrack?.score ?? 101;
    return all
      .filter((p) => p.goal.live && (p.plan.daysLeft === null || p.plan.daysLeft >= 0))
      .map((progress) => ({ progress, flags: TutorBoard.flags(progress) }))
      .sort(
        (a, b) =>
          Number(b.flags.length > 0) - Number(a.flags.length > 0) ||
          score(a) - score(b) ||
          b.progress.streak.missedRun - a.progress.streak.missedRun ||
          a.progress.goal.name.localeCompare(b.progress.goal.name),
      );
  }
}
