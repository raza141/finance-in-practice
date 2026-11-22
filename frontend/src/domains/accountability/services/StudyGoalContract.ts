import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import type { GoalInput, GoalOption, StudyKind } from "../types";

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** The student's two forms, checked. Server actions are public endpoints: nothing here trusts the browser. */
export class StudyGoalContract {
  static readonly KINDS: readonly StudyKind[] = ["reading", "video", "other"];
  static readonly DEFAULT_TARGET = 300;
  static readonly MAX_LOG_MINUTES = 480;
  /** Within the 077 CHECKs, and no plan so long that counting its days gets slow. */
  static readonly MAX_PLAN_DAYS = 1100;

  static goal(form: FormData, options: readonly GoalOption[], now: Date = new Date()): Parsed<GoalInput> {
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const option = options.find((o) => o.course === text("course"));
    if (!option) return { ok: false, error: "Pick your CFA level." };
    const timeZone = text("timeZone");
    if (!ZonedCalendar.isValidTimeZone(timeZone)) return { ok: false, error: "Pick your time zone." };
    const today = new ZonedCalendar(timeZone).today(now);

    const startedOn = text("startedOn");
    if (!ZonedCalendar.isIsoDate(startedOn) || startedOn > today || ZonedCalendar.daysBetween(startedOn, today) > StudyGoalContract.MAX_PLAN_DAYS)
      return { ok: false, error: "Enter the day you started studying." };

    // A batch's date always wins, so a typed one is never stored beside it.
    const examOn = option.examOn ? null : text("examOn");
    if (examOn !== null && (!ZonedCalendar.isIsoDate(examOn) || examOn <= today || ZonedCalendar.daysBetween(today, examOn) > StudyGoalContract.MAX_PLAN_DAYS))
      return { ok: false, error: "Enter a future exam date." };

    const target = StudyGoalContract.number(text("targetHours"));
    if (target === null || !Number.isInteger(target) || target < 20 || target > 2000) return { ok: false, error: "Target hours must be 20 to 2,000." };
    const perDay = StudyGoalContract.number(text("hoursPerDay"));
    if (perDay === null || perDay < 0.5 || perDay > 16) return { ok: false, error: "Hours a day must be 0.5 to 16." };
    const prior = text("priorHours") === "" ? 0 : StudyGoalContract.number(text("priorHours"));
    if (prior === null || prior < 0 || prior > 2000) return { ok: false, error: "Hours already studied must be 0 to 2,000." };

    const studyDays = [...new Set(form.getAll("studyDays").map(Number))].sort((a, b) => a - b);
    if (studyDays.length === 0 || studyDays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return { ok: false, error: "Pick at least one study day." };

    return {
      ok: true,
      value: {
        course: option.course,
        examOn,
        startedOn,
        targetHours: target,
        hoursPerDay: Math.round(perDay * 10) / 10,
        priorMinutes: Math.round(prior * 60),
        studyDays,
        timeZone,
      },
    };
  }

  /** Today or yesterday only. */
  static log(form: FormData, today: string): Parsed<{ date: string; minutes: number; kind: StudyKind }> {
    const date = String(form.get("date") ?? "");
    if (date !== today && date !== ZonedCalendar.addDays(today, -1)) return { ok: false, error: "Log today or yesterday." };
    const minutes = StudyGoalContract.number(String(form.get("minutes") ?? ""));
    if (minutes === null || !Number.isInteger(minutes) || minutes < 1 || minutes > StudyGoalContract.MAX_LOG_MINUTES)
      return { ok: false, error: "Minutes must be 1 to 480." };
    const kind = StudyGoalContract.KINDS.find((k) => k === form.get("kind"));
    if (!kind) return { ok: false, error: "Pick reading, video or other." };
    return { ok: true, value: { date, minutes, kind } };
  }

  private static number(raw: string): number | null {
    return /^\d{1,5}(\.\d{1,2})?$/.test(raw) ? Number(raw) : null;
  }
}
