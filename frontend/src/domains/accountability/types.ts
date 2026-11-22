/** The levels with a question bank and a course. Schema 077 also allows III, for when there's one. */
export type GoalLevel = 1 | 2;
export type Difficulty = "" | "easy" | "medium" | "hard";
export type StudyKind = "reading" | "video" | "other";

/** A student's plan for one course (study_goals, 077). Dates are yyyy-mm-dd in the student's own zone. */
export interface StudyGoal {
  clientId: string;
  name: string;
  email: string;
  hideCountdown: boolean;
  /** The course is still open to them (client_live_courses). */
  live: boolean;
  course: string;
  level: GoalLevel;
  /** The batch's date (the student's picked day) when there is one, else the date they typed. */
  examOn: string | null;
  startedOn: string;
  createdOn: string;
  targetHours: number;
  hoursPerDay: number;
  priorMinutes: number;
}

export interface GoalInput {
  course: string;
  examOn: string | null;
  startedOn: string;
  targetHours: number;
  hoursPerDay: number;
  priorMinutes: number;
  studyDays: number[];
  timeZone: string;
}

/** A course the student may plan for; examOn: their batch's date, which wins over a typed one. */
export interface GoalOption {
  course: string;
  level: GoalLevel;
  examOn: string | null;
}

/** One study_schedules row; `from` is the local date it was saved. */
export interface ScheduleRow {
  from: string;
  timeZone: string;
  /** ISO weekdays, Monday 1. */
  days: number[];
}

/** One local day's study. */
export interface DayTotal {
  date: string;
  questions: number;
  minutes: number;
}

export interface Mark {
  difficulty: Difficulty;
  correct: number;
  total: number;
}

export interface LogEntry {
  id: string;
  date: string;
  minutes: number;
  kind: StudyKind;
}

/** Everything read for one student with a goal; every derived figure comes from this. */
export interface StudyFacts {
  goal: StudyGoal;
  schedule: ScheduleRow[];
  /** What the streak's bar reads: questions on any course, and manual time only if logged on the day itself. */
  days: DayTotal[];
  /** Minutes towards this goal, by day: its level's questions and its course's log. */
  goalMinutes: { date: string; minutes: number }[];
  /** The last 14 days' answers in finished attempts at the goal's level. */
  marks: Mark[];
  chapters: { touched: number; total: number };
  weakest: { name: string; correct: number; total: number }[];
  /** The last five finished mocks' percentages, oldest first. */
  mockScores: number[];
}

export type FormResult = { ok: boolean; message: string } | null;
