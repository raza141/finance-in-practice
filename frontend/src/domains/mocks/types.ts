export type MockType = "book" | "topic" | "random" | "full";
export type OptionLetter = "A" | "B" | "C";
/** Who sees a mock: every portal student, those on certain courses, or named clients. */
export type MockAudience = "all" | "course" | "clients";

export interface MockAccess {
  audience: MockAudience;
  /** Course titles as on clients.courses; used when audience is "course". */
  courses: string[];
  /** Client ids; used when audience is "clients". */
  clients: string[];
}

/** A portal student the admin can grant a mock to. */
export interface MockStudent {
  id: string;
  name: string;
  email: string;
  courses: string[];
}

export interface MockExamInput {
  title: string;
  mockType: MockType;
  /** "Book 2: Quantitative Methods", or "Random pool". */
  source: string;
  durationMinutes: number;
}

export interface MockExam extends MockExamInput {
  id: string;
  published: boolean;
  audience: MockAudience;
  courses: string[];
  questionCount: number;
  /** Any attempts: the questions are then fixed and the mock can't be deleted. */
  attempted: boolean;
  createdAt: Date;
}

/** One row of the uploaded sheet. Text fields use the journal's inline markup: $…$ and $$…$$ for maths. */
export interface MockQuestionInput {
  number: number;
  topic: string;
  vignette: string;
  question: string;
  options: [string, string, string];
  correct: OptionLetter;
  explanation: string;
}

/** A question as a student sees it during an attempt: no answer, no explanation. */
export interface ActiveQuestion {
  id: string;
  number: number;
  topic: string;
  vignette: string;
  question: string;
  options: [string, string, string];
}

export interface MockQuestion extends ActiveQuestion {
  correct: OptionLetter;
  explanation: string;
}

/** A question in the bank, with the mock it was uploaded to. */
export interface PoolQuestion extends MockQuestion {
  mockId: string;
  mockTitle: string;
}

export interface MockResponse {
  questionId: string;
  selected: OptionLetter | null;
  flagged: boolean;
  notes: string;
}

export type AttemptStatus = "in_progress" | "completed";

export interface MockAttempt {
  id: string;
  clientId: string;
  mockId: string;
  startedAt: Date;
  endsAt: Date;
  submittedAt: Date | null;
  score: number | null;
  total: number;
  status: AttemptStatus;
  /** 1, or 2 in the second half of a full mock. */
  session: number;
  /** Set when session 1 of a full mock closed: session 2's clock starts then, or sooner if the student starts it. */
  breakUntil: Date | null;
}

/** Lobby history row. */
export interface AttemptSummary {
  id: string;
  mockId: string;
  mockTitle: string;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  total: number;
  status: AttemptStatus;
}

export interface TopicScore {
  topic: string;
  correct: number;
  total: number;
}

export interface MockGrade {
  score: number;
  total: number;
  topics: TopicScore[];
}

/** One topic of one closed attempt: a row of the Progress tab's data. */
export interface TopicMark {
  attemptId: string;
  title: string;
  /** When it was submitted (ISO). */
  at: string;
  topic: string;
  correct: number;
  total: number;
}
