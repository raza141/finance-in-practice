import type { Agreement, ClientDocument, Currency, ItemUnit } from "@/domains/invoices/types";

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
  /** Exam courses: the sitting picked, e.g. "Nov 2026" or "Not sure yet"; otherwise "". */
  batch: string;
  /** The package picked (053_packages); null only while no package is published. */
  packageId: string | null;
}

/** "none": not asked yet. Only "approved" reveals the invite (039_portal_controls). */
export type ClassroomAccess = "none" | "requested" | "approved" | "removed";

/** One of the student's courses that has a Google Classroom. `url` only once approved. */
export interface StudentClassroom {
  title: string;
  /** An exam course: its class comes from the student's batch (043). */
  batched: boolean;
  /** Their sitting, e.g. "Nov 2026" or "Not sure yet"; null when not set (or not an exam course). */
  batch: string | null;
  /** A class exists to ask for: the course's, or their batch's once opened with a link. */
  hasClass: boolean;
  access: ClassroomAccess;
  url: string | null;
}

/** One Google class per exam course and sitting (043_batches). */
export interface Batch {
  id: string;
  course: string;
  label: string;
  examDate: string;
  classroomUrl: string | null;
  students: number;
}

/** A Google Classroom for one student only (040_private_classrooms); visible as soon as the owner adds it. */
export interface PrivateClassroom {
  id: string;
  title: string;
  /** One line about the class, e.g. "AP Statistics: notes, homework and mocks". */
  note: string;
  url: string;
}

/** One Dubai calendar month of the student's account: time studied, booked ahead, money billed and paid. */
export interface AccountMonth {
  /** YYYY-MM. */
  month: string;
  minutesTaken: number;
  sessionsTaken: number;
  /** Upcoming sessions (accepted or awaiting confirmation) starting this month. */
  minutesBooked: number;
  sessionsBooked: number;
  billed: { currency: Currency; minor: number }[];
  paid: { currency: Currency; minor: number }[];
  /** Monthly agreements covering this month: the agreed fee (the invoice may be less). */
  agreed: { currency: Currency; minor: number }[];
}

/** All-time money in one currency (never added across currencies). */
export interface AccountMoney {
  currency: Currency;
  chargedMinor: number;
  paidMinor: number;
  creditedMinor: number;
  /** What is still owed; negative = in credit. */
  balanceMinor: number;
}

/** Hours or sessions on their invoices against those taken: what is left of a prepaid block. */
export interface PrepaidBlock {
  unit: "hour" | "session";
  billed: number;
  used: number;
}

export interface StudentPlan {
  unit: ItemUnit;
  feeMinor: number;
  currency: Currency;
}

/** The owner's record of time actually studied (049_session_log): a booking's real length, or a session never booked in Cal.com. */
export interface SessionLogEntry {
  id: string;
  /** Set for a Cal.com booking; null for a session logged by hand. */
  bookingUid: string | null;
  /** YYYY-MM-DD, for a session logged by hand. */
  onDate: string | null;
  /** 0 = it didn't happen. */
  minutes: number;
  note: string;
}

export type SessionLogInput = Omit<SessionLogEntry, "id">;

/** An agreement as the student sees it. */
export type AccountAgreement = Pick<
  Agreement,
  "id" | "serviceName" | "unit" | "rateMinor" | "currency" | "startsOn" | "endsOn" | "scope" | "hoursPerMonth" | "acceptedAt"
> & {
  /** Monthly with an end date: agreement months after the current one. */
  monthsLeft: number | null;
  remainingMinor: number | null;
  /** Monthly: the agreement month running today (or its first, before it starts). */
  period: { number: number; of: number | null; start: string; end: string } | null;
  /** With an end date: days until it ends. */
  daysLeft: number | null;
};

/** The student portal's Account tab (StudentAccount.build). */
export interface StudentAccountView {
  /** Oldest first: the last months up to this one, then next month. */
  months: AccountMonth[];
  /** Null when Cal.com couldn't be read: unknown, not zero. */
  taken: { minutes: number; sessions: number } | null;
  money: AccountMoney[];
  prepaid: PrepaidBlock[];
  plan: StudentPlan | null;
  /** Live agreements (not ended before this month), newest first. */
  agreements: AccountAgreement[];
  /** This month's hours on a monthly agreement with a limit; null without one (or when sessions couldn't be read). */
  allowance: MonthAllowance | null;
  /** Hourly or per-session: time taken that no invoice covers yet, at their rate. */
  uninvoiced: { unit: "hour" | "session"; quantity: number; amountMinor: number; currency: Currency } | null;
  next: {
    month: string;
    minutesBooked: number;
    sessionsBooked: number;
    /** Average minutes a month over the last full months they studied (up to 3); null without history. */
    paceMinutes: number | null;
    /** The plan fee for next month at that pace (or at what is booked); null without a usable plan. */
    estimateMinor: number | null;
  };
  /** Null when the documents couldn't be read. */
  documents: ClientDocument[] | null;
}

export type HourRequestStatus = "pending" | "free" | "billed" | "declined";

/** A student's ask for more hours once their month's allowance is used (050_allowances_terms). */
export interface HourRequest {
  id: string;
  agreementId: string;
  /** YYYY-MM. */
  month: string;
  hours: number;
  note: string;
  /** "free": approved as included; "billed": approved as extra to pay. */
  status: HourRequestStatus;
  createdAt: Date;
}

/** One month of a monthly agreement's hours: included, extra approved, used (1-on-1 only) and left. */
export interface MonthAllowance {
  agreementId: string;
  serviceName: string;
  /** A package's hours: one period for the whole agreement (periodEnd = Allowance.OPEN_END when it has no end). */
  package: boolean;
  /** YYYY-MM of the agreement month's start: the key requests use. */
  month: string;
  /** The agreement month, e.g. 17 Oct – 16 Nov (YYYY-MM-DD, inclusive). */
  periodStart: string;
  periodEnd: string;
  includedMinutes: number;
  /** Approved requests, included or billed. */
  extraMinutes: number;
  extraBilledMinutes: number;
  takenMinutes: number;
  /** Upcoming sessions this month. */
  bookedMinutes: number;
  /** Negative = over. */
  leftMinutes: number;
  pending: HourRequest | null;
}
