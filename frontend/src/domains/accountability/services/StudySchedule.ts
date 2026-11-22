import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import type { ScheduleRow } from "../types";

/**
 * Which days are study days. A change takes effect the day after it was saved, so nobody can turn today
 * (or a missed day) into a rest day afterwards. The first schedule covers everything before it.
 */
export class StudySchedule {
  static readonly DEFAULT_ZONE = "Asia/Dubai";

  /** `rows` oldest first. */
  constructor(private readonly rows: readonly ScheduleRow[]) {}

  get timeZone(): string {
    return this.rows.at(-1)?.timeZone ?? StudySchedule.DEFAULT_ZONE;
  }

  get days(): number[] {
    return this.rows.at(-1)?.days ?? [1, 2, 3, 4, 5, 6, 7];
  }

  today(now: Date = new Date()): string {
    return new ZonedCalendar(this.timeZone).today(now);
  }

  planned(date: string): boolean {
    let row = this.rows[0];
    for (const next of this.rows.slice(1)) if (next.from < date) row = next;
    const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    return !row || row.days.includes(weekday);
  }

  /** Study days in [from, to). */
  count(from: string, to: string): number {
    let count = 0;
    for (let day = from; day < to; day = ZonedCalendar.addDays(day, 1)) if (this.planned(day)) count++;
    return count;
  }
}
