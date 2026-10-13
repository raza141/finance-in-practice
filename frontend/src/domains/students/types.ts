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
