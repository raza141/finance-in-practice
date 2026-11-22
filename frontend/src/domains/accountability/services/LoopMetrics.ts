import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import { OnTrack } from "./OnTrack";
import type { StudentProgress } from "./StudyProgress";

export interface Share {
  count: number;
  of: number;
}

/**
 * The brief's metrics, from the same rows (ended plans included, so drop-outs still count). "Active" is studying,
 * not opening a page. D7 and D30: studied in the week starting that many days after making the plan. Tutored
 * against solo waits for self-study students: everyone with a plan is tutored today.
 */
export class LoopMetrics {
  static readonly STREAK = 7;

  static of(all: readonly StudentProgress[]): { streak7: Share; onTrack: Share; d7: Share; d30: Share; returned: Share } {
    const add = ZonedCalendar.addDays;
    const studiedIn = (p: StudentProgress, from: string, to: string) => p.activeDays.some((d) => d >= from && d <= to);
    const share = <T>(rows: readonly T[], hit: (row: T) => boolean): Share => ({ count: rows.filter(hit).length, of: rows.length });

    const weekly = all.filter((p) => studiedIn(p, add(p.today, -6), p.today));
    const scored = all.filter((p) => p.goal.live && p.onTrack !== null);
    const retained = (day: number) =>
      share(
        all.filter((p) => add(p.goal.createdOn, day + 6) < p.today),
        (p) => studiedIn(p, add(p.goal.createdOn, day), add(p.goal.createdOn, day + 6)),
      );
    const broken = all.flatMap((p) => p.streak.breaks.filter((day) => day >= p.goal.createdOn && add(day, 7) < p.today).map((day) => ({ p, day })));
    return {
      streak7: share(weekly, (p) => p.streak.current >= LoopMetrics.STREAK),
      onTrack: share(scored, (p) => p.onTrack!.score >= OnTrack.GREEN),
      d7: retained(7),
      d30: retained(30),
      returned: share(broken, ({ p, day }) => studiedIn(p, add(day, 1), add(day, 7))),
    };
  }
}
