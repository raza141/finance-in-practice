/** The slices of Google Classroom API resources we read (v1). */
export interface GCourse {
  id: string;
  name: string;
  section?: string;
  alternateLink?: string;
  enrollmentCode?: string;
}

export interface GMaterial {
  driveFile?: { driveFile?: { title?: string; alternateLink?: string } };
  youtubeVideo?: { title?: string; alternateLink?: string };
  link?: { url?: string; title?: string };
  form?: { formUrl?: string; title?: string };
}

interface GAssignable {
  id: string;
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  materials?: GMaterial[];
  assigneeMode?: "ALL_STUDENTS" | "INDIVIDUAL_STUDENTS";
  individualStudentsOptions?: { studentIds?: string[] };
  topicId?: string;
}

export interface GWork extends GAssignable {
  title: string;
  description?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number };
  maxPoints?: number;
  workType?: "ASSIGNMENT" | "SHORT_ANSWER_QUESTION" | "MULTIPLE_CHOICE_QUESTION";
}

export interface GWorkMaterial extends GAssignable {
  title: string;
  description?: string;
}

export interface GAnnouncement extends GAssignable {
  text?: string;
}

export interface GCourseData {
  work: GWork[];
  materials: GWorkMaterial[];
  announcements: GAnnouncement[];
  topics: { topicId: string; name: string }[];
}

export interface GStudent {
  userId: string;
  profile?: { emailAddress?: string; name?: { fullName?: string } };
}

export interface GSubmission {
  courseWorkId: string;
  userId: string;
  state?: "NEW" | "CREATED" | "TURNED_IN" | "RETURNED" | "RECLAIMED_BY_STUDENT";
  late?: boolean;
  assignedGrade?: number;
}

export type ClassItemKind = "quiz" | "assignment" | "question" | "material" | "announcement";
/** todo: assigned, not handed in; missing: past due; done: turned in; returned: marked and given back. */
export type ClassItemStatus = "todo" | "missing" | "done" | "returned";

/** One thing posted in a class, as one student sees it. */
export interface ClassItem {
  id: string;
  /** The website course or private class it belongs to. */
  classTitle: string;
  kind: ClassItemKind;
  title: string;
  /** First lines of the description or announcement. */
  text: string;
  /** Opens the item in Google Classroom. */
  link: string | null;
  postedAt: string;
  dueAt: string | null;
  topic: string | null;
  /** Null for materials and announcements (nothing to hand in). */
  status: ClassItemStatus | null;
  late: boolean;
  grade: { points: number; max: number } | null;
  /** Under a "Mock exams" topic: counts on the progress chart. */
  mock: boolean;
  files: { title: string; url: string }[];
}

/** A class the student should see, matched to Google by its invite link. */
export interface StudentClass {
  title: string;
  /** False: not on the class list with their Classroom email yet. */
  joined: boolean;
}

export interface StudentFeed {
  classes: StudentClass[];
  items: ClassItem[];
  /** ISO time the student last opened their feed (for "New"). */
  seenAt: string | null;
  /** The email we look them up with in Classroom. */
  email: string;
}
