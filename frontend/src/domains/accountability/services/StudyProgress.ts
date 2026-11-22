import type { StudyFacts, StudyGoal } from "../types";
import { OnTrack, type OnTrackState } from "./OnTrack";
import { StreakEngine, type StreakState } from "./StreakEngine";
import { StudyPlan, type PlanState } from "./StudyPlan";
import { StudySchedule } from "./StudySchedule";

export interface StudentProgress {
  goal: StudyGoal;
  schedule: StudySchedule;
  today: string;
  plan: PlanState;
  /** Null before the first study day is over, with no exam date, or after the exam. */
  onTrack: OnTrackState | null;
  streak: StreakState;
  lastActive: string | null;
  /** Plain share right over 14 days. */
  accuracy: number | null;
  chapters: StudyFacts["chapters"];
  weakest: StudyFacts["weakest"];
  mockScores: number[];
}

/** One student's whole picture from their facts: the portal and the tutor's page read the same one. Pure. */
export class StudyProgress {
  static of(facts: StudyFacts, now: Date = new Date()): StudentProgress {
    const { goal } = facts;
    const schedule = new StudySchedule(facts.schedule);
    const today = schedule.today(now);
    const plan = StudyPlan.state({ goal, schedule, minutes: facts.goalMinutes, today });
    const active = [...facts.days.filter((d) => d.questions > 0 || d.minutes > 0), ...facts.goalMinutes.filter((d) => d.minutes > 0)].map((d) => d.date);
    return {
      goal,
      schedule,
      today,
      plan,
      onTrack:
        plan.elapsed > 0 && plan.daysLeft !== null && plan.daysLeft >= 0
          ? OnTrack.score({ hoursDone: plan.hoursDone, targetHours: goal.targetHours, elapsed: plan.elapsed, total: plan.total, chapters: facts.chapters, marks: facts.marks })
          : null,
      streak: StreakEngine.state({ days: facts.days, schedule, today, trackedFrom: goal.createdOn }),
      lastActive: active.reduce<string | null>((last, date) => (last && last > date ? last : date), null),
      accuracy: OnTrack.plainAccuracy(facts.marks),
      chapters: facts.chapters,
      weakest: facts.weakest,
      mockScores: facts.mockScores,
    };
  }
}
