export type MockType = "book" | "topic" | "chapter" | "random" | "full";
/** Where a bank question may go: practice sets, mocks, or either. */
export type QuestionUsage = "practice" | "mock" | "both";
export type OptionLetter = "A" | "B" | "C";
/** CFA level: Level II is item sets, a vignette with four questions. */
export type CfaLevel = 1 | 2;
/** Who sees a mock: every portal student, those on certain courses, or only students with a grant (the setting for a paid mock). */
export type MockAudience = "all" | "course" | "clients";

export interface MockAccess {
  audience: MockAudience;
  /** Course titles as on clients.courses; used when audience is "course". */
  courses: string[];
  /** Client ids; used when audience is "clients". */
  clients: string[];
  /** When those clients' access to this mock ends; null: no end. */
  endsAt: Date | null;
}

/** "builder": the student may make their own sets from the bank. */
export type AccessProduct = "mocks" | "practice" | "builder";
/** fundamental: theory, no calculation; formula: a number has to be worked out. "" untagged. */
export type QuestionKind = "fundamental" | "formula";
export type QuestionDifficulty = "easy" | "medium" | "hard";

/** A bank question's tags. "" is untagged. */
export interface QuestionTags {
  /** Where it came from, e.g. "FIP 2025 MOCK S1 - Mock 1". */
  source: string;
  /** The exam sitting, "2025 S1". */
  session: string;
  difficulty: QuestionDifficulty | "";
  kind: QuestionKind | "";
}

/** Narrows a draw from the bank; "" in a field: any. */
export type BankFilter = { chapter: string } & QuestionTags;
export type GrantSource = "admin" | "package" | "purchase";

/** What a grant gives: a whole product, or one mock. */
export type GrantTarget = { product: AccessProduct; mockId: null } | { product: null; mockId: string };

export type AccessGrantInput = GrantTarget & { startsAt: Date; endsAt: Date | null };

/** One client's access to a product or a mock, with the mock's title when it's for one. */
export type AccessGrant = AccessGrantInput & { id: string; mockTitle: string | null; source: GrantSource };

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
  level: CfaLevel;
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
export interface MockQuestionInput extends QuestionTags {
  number: number;
  topic: string;
  /** Free text like the topic; "" when the sheet has none. */
  chapter: string;
  usage: QuestionUsage;
  level: CfaLevel;
  vignette: string;
  question: string;
  options: [string, string, string];
  correct: OptionLetter;
  explanation: string;
  /** Why each option tempts, shown on a wrong pick ("" for none; the correct option's is unused). */
  why: [string, string, string];
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
  why: [string, string, string];
}

/** A question in the bank. */
export interface PoolQuestion extends MockQuestion, QuestionTags {
  chapter: string;
  usage: QuestionUsage;
  level: CfaLevel;
  /** Can't be picked for a new assessment; stays in the ones that use it. */
  retired: boolean;
  /** In an assessment students have started: its text is fixed, as results are graded from it. */
  locked: boolean;
  /** Titles of the assessments that use it. */
  usedIn: string[];
}

export type Confidence = "sure" | "guess";

export interface MockResponse {
  questionId: string;
  selected: OptionLetter | null;
  flagged: boolean;
  notes: string;
  /** Time spent on the question, all visits added up. */
  seconds: number;
  /** The student's own mark on their answer; null: not given. */
  confidence: Confidence | null;
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
  /** Set while the student has paused: the clock is stopped and the questions hidden until they resume. */
  pausedAt: Date | null;
  /** A retake of one attempt's mistakes: just these questions, in one sitting. Null: the whole mock. */
  questionIds: string[] | null;
  /** The one screen (a browser tab's random id) allowed to save; null until a screen opens it. */
  screen: string | null;
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
  /** A retake of only the incorrect and flagged questions. */
  mistakes: boolean;
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

/** A question in the student's mistakes notebook: wrong at least once, not yet right twice in a row since. */
export interface NotebookEntry {
  /** The newest copy the student met. */
  id: string;
  topic: string;
  level: CfaLevel;
  vignette: string;
  question: string;
  options: [string, string, string];
  correct: OptionLetter;
  explanation: string;
  why: [string, string, string];
  /** Their pick the last time they got it wrong (null: left blank). */
  lastWrong: OptionLetter | null;
  timesWrong: number;
  /** Right but flagged as unsure. */
  timesFlagged: number;
  /** Right answers since the last wrong one: two takes it out. */
  streak: number;
  /** When they last met it (ISO). */
  at: string;
}

/** One attempt on the owner's mock activity page (drills left out). */
export interface MockActivityRow {
  attemptId: string;
  clientId: string;
  clientName: string;
  mockTitle: string;
  startedAt: Date;
  endsAt: Date;
  submittedAt: Date | null;
  pausedAt: Date | null;
  score: number | null;
  total: number;
  status: AttemptStatus;
  /** A second go at the mock, or a retake of one attempt's mistakes. */
  retake: boolean;
  /** The owner has marked a finished attempt seen. */
  seen: boolean;
}

/** A published mock open to a student who hasn't started it. */
export interface MockAssignment {
  mockId: string;
  mockTitle: string;
  clientId: string;
  clientName: string;
  /** When their grant to it ends; null: no end, or open through audience/course. */
  endsAt: Date | null;
}

/** A grant whose end date has passed: the student can no longer open it. */
export interface ExpiredGrant {
  clientId: string;
  clientName: string;
  /** "All mocks", "All practice sets", or the mock's title. */
  target: string;
  endedAt: Date;
}
