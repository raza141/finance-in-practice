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
  /** Session length, one of siteConfig.studentBooking.lengths. */
  minutes: number;
  /** In person, optional: a Google Maps link to the exact spot. */
  mapUrl: string;
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

/** A booked session as the student portal shows it (from Cal.com). */
export interface StudentSession {
  uid: string;
  start: string;
  end: string;
  minutes: number;
  course: string;
  status: "accepted" | "pending";
  meetingUrl: string | null;
  /** In person: where. */
  address: string | null;
  /** More than one student booked on it (a group class or mock): only the instructor changes it. */
  group: boolean;
}

/** What a new student gives when joining (email always from Google). */
export interface RegistrationInput {
  name: string;
  email: string;
  phone: string;
  /** A published course title, a consultancy, or "Other: <topic>". */
  course: string;
}
