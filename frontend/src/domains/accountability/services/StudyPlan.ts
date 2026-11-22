import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import type { StudyGoal } from "../types";
import type { StudySchedule } from "./StudySchedule";

export interface PlanState {
  /** Null with no exam date; negative once it has passed. */
  daysLeft: number | null;
  hoursDone: number;
  /** (target − done) ÷ study days left; null when none are left. */
  perDay: number | null;
  /** Still to do today; 0 on a rest day. */
  todayHours: number;
  restDay: boolean;
  /** More a day than the student said they have. */
  overCapacity: boolean;
  /** Planned days before today, and in the whole plan. */
  elapsed: number;
  total: number;
}

/** F1: the countdown and the hours it takes to finish on time. Pure. */
export class StudyPlan {
  static state(input: {
    goal: Pick<StudyGoal, "examOn" | "startedOn" | "targetHours" | "hoursPerDay" | "priorMinutes">;
    schedule: StudySchedule;
    /** Minutes by day; only those since started_on count (earlier ones are in priorMinutes). */
    minutes: readonly { date: string; minutes: number }[];
    today: string;
  }): PlanState {
    const { goal, schedule, today } = input;
    let done = goal.priorMinutes;
    let doneToday = 0;
    for (const day of input.minutes) {
      if (day.date < goal.startedOn || day.date > today) continue;
      done += day.minutes;
      if (day.date === today) doneToday += day.minutes;
    }
    const exam = goal.examOn;
    const remaining = exam ? schedule.count(today, exam) : 0;
    const left = (minutes: number) => Math.max(0, goal.targetHours - minutes / 60);
    const perDay = remaining ? left(done) / remaining : null;
    const restDay = !schedule.planned(today);
    // Fixed for the day, so logging an hour takes an hour off what's left today.
    const todayHours = remaining && !restDay ? Math.max(0, left(done - doneToday) / remaining - doneToday / 60) : 0;
    return {
      daysLeft: exam ? ZonedCalendar.daysBetween(today, exam) : null,
      hoursDone: done / 60,
      perDay,
      todayHours,
      restDay,
      overCapacity: perDay !== null && perDay > goal.hoursPerDay,
      elapsed: exam ? schedule.count(goal.startedOn, today < exam ? today : exam) : 0,
      total: exam ? schedule.count(goal.startedOn, exam) : 0,
    };
  }
}
