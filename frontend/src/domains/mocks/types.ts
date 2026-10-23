export type MockType = "book" | "topic" | "random" | "full";
export type OptionLetter = "A" | "B" | "C";

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
