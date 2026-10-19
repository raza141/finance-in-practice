export type Difficulty = "easy" | "medium" | "hard";

/** One answer choice; `why` says why it is wrong (or, for the correct one, may stay empty). */
export interface QuestionOption {
  text: string;
  why: string;
}

/** What the admin form edits. Text fields use the journal's inline markup: $…$ and $$…$$ for maths. */
export interface QuestionInput {
  level: 1 | 2 | 3;
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
  slug: string;
  title: string;
  description: string;
  stem: string;
  options: QuestionOption[];
  correct: number;
  formula: string;
  solution: string;
  trap: string;
  imageUrl: string | null;
  imageAlt: string;
  source: string;
  /** Null keeps it a draft; a future time schedules it. */
  publishAt: Date | null;
}

export interface Question extends QuestionInput {
  id: string;
  /** FIP-CFA-L1-FI-001: assigned on create, internal only. */
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Listing cards (library, topic pages, related questions). */
export interface QuestionSummary {
  code: string;
  level: number;
  topic: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  publishAt: Date;
}

export interface QuestionSwitch {
  pagesOn: boolean;
  emailsOn: boolean;
}
