import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import type { DayTotal } from "../types";
import type { StudySchedule } from "./StudySchedule";

export interface EarnBack {
  /** The missed day it would restore. */
  missed: string;
  /** Last local day of the 48 hours. */
  until: string;
  questionsLeft: number;
  minutesLeft: number;
}

export interface StreakState {
  current: number;
  best: number;
  /** No freeze and no Earn Back in the current streak. */
  perfect: boolean;
  freezesLeft: number;
  /** The oldest open Earn Back; the streak is kept while it's open. */
  earnBack: EarnBack | null;
  qualifiedToday: boolean;
  /** Planned days missed in a row up to yesterday, frozen ones included. */
  missedRun: number;
  /** The missed day each lost streak broke on. */
  breaks: string[];
}

/**
 * F3 + F4: streak, freezes and Earn Back, worked out from daily totals every time, so nothing is stored and no
 * midnight job runs. Dates are the student's local days. Pure.
 *
 * - A day counts with 20 questions or 45 minutes. Today, unfinished, never breaks anything.
 * - Rest days neither count nor break; studying on one counts.
 * - A missed planned day takes one of the month's two freezes (no rollover), only while there's a streak to keep.
 * - With none left, Earn Back runs for the next two local days: 40 questions or 90 minutes in total restores it.
 *   Work that restored one day can't restore another; those days still count for themselves.
 * - Frozen and restored days keep the streak without adding to it.
 */
export class StreakEngine {
  static readonly BAR = { questions: 20, minutes: 45 } as const;
  static readonly FREEZES_A_MONTH = 2;
  static readonly EARN_BACK = { multiple: 2, days: 2 } as const;
  static readonly MILESTONES = [7, 30, 100, 365] as const;

  static qualifies(day: Pick<DayTotal, "questions" | "minutes"> | undefined): boolean {
    return !!day && (day.questions >= StreakEngine.BAR.questions || day.minutes >= StreakEngine.BAR.minutes);
  }

  static nextMilestone(current: number): number | null {
    return StreakEngine.MILESTONES.find((m) => m > current) ?? null;
  }

  /** `trackedFrom`: when the plan was made; missed days before it are never flagged. */
  static state(input: { days: readonly DayTotal[]; schedule: StudySchedule; today: string; trackedFrom: string }): StreakState {
    const { schedule, today, trackedFrom } = input;
    const { BAR, EARN_BACK } = StreakEngine;
    const next = (date: string) => ZonedCalendar.addDays(date, 1);
    const byDay = new Map(input.days.map((d) => [d.date, d]));
    const qualified = input.days.filter((d) => d.date <= today && StreakEngine.qualifies(d)).map((d) => d.date);
    const first = [trackedFrom, ...qualified].reduce((a, b) => (a < b ? a : b));
    const month = today.slice(0, 7);
    const used = new Map<string, number>();
    const breaks: string[] = [];
    let current = 0;
    let best = 0;
    let perfect = true;
    let missedRun = 0;
    let earnBack: EarnBack | null = null;
    /** The last day whose work an Earn Back has used. */
    let spentThrough = "";

    for (let day = first; day <= today; day = next(day)) {
      if (StreakEngine.qualifies(byDay.get(day))) {
        if (current === 0) perfect = true;
        current++;
        missedRun = 0;
        // A streak held open by an Earn Back isn't a record until it's restored.
        if (!earnBack) best = Math.max(best, current);
        continue;
      }
      if (day === today || !schedule.planned(day)) continue;
      if (day >= trackedFrom) missedRun++;
      if (current === 0) continue;

      const frozen = used.get(day.slice(0, 7)) ?? 0;
      if (frozen < StreakEngine.FREEZES_A_MONTH) {
        used.set(day.slice(0, 7), frozen + 1);
        perfect = false;
        continue;
      }

      const until = ZonedCalendar.addDays(day, EARN_BACK.days);
      let questions = 0;
      let minutes = 0;
      let restoredOn = "";
      for (let d = next(day); d <= until && d <= today; d = next(d)) {
        if (d <= spentThrough) continue;
        questions += byDay.get(d)?.questions ?? 0;
        minutes += byDay.get(d)?.minutes ?? 0;
        if (questions >= BAR.questions * EARN_BACK.multiple || minutes >= BAR.minutes * EARN_BACK.multiple) {
          restoredOn = d;
          break;
        }
      }
      if (restoredOn) {
        spentThrough = restoredOn;
        perfect = false;
      } else if (until >= today) {
        perfect = false;
        earnBack ??= {
          missed: day,
          until,
          questionsLeft: BAR.questions * EARN_BACK.multiple - questions,
          minutesLeft: Math.ceil(BAR.minutes * EARN_BACK.multiple - minutes),
        };
      } else {
        breaks.push(day);
        current = 0;
      }
    }

    return {
      current,
      best,
      perfect: current > 0 && perfect,
      freezesLeft: StreakEngine.FREEZES_A_MONTH - (used.get(month) ?? 0),
      earnBack,
      qualifiedToday: StreakEngine.qualifies(byDay.get(today)),
      missedRun,
      breaks,
    };
  }
}
