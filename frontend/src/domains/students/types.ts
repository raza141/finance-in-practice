/** An enrolled student: a client the owner gave at least one course in admin Clients. */
export interface Student {
  id: string;
  name: string;
  email: string;
  /** Course titles from the client's plan; the booking form's course list. */
  courses: string[];
}

export type SessionMode = "online" | "in_person";

export interface StudentBookingRequest {
  start: string;
  timeZone: string;
  /** One of the student's courses, or StudentBookingContract.OTHER. */
  course: string;
  /** Required when course is "Other": what the session should cover. */
  topic: string;
  mode: SessionMode;
  /** Required in person: where in Abu Dhabi. */
  address: string;
  notes: string;
}

export type StudyStatus = "planned" | "done" | "skipped";

/** One row of a student's study plan (036_study_plan). */
export interface StudyPlanItem {
  id: string;
  /** YYYY-MM-DD; null when not scheduled yet. */
  dueOn: string | null;
  topic: string;
  status: StudyStatus;
  note: string;
  /** https link to the material, e.g. a Google Drive file shared with the student. */
  materialUrl: string | null;
}

export type StudyPlanInput = Omit<StudyPlanItem, "id">;
