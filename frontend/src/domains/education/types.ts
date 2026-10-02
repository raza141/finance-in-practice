export type PillarId = "exam-prep" | "university" | "automation" | "lms";

export type PillarStatus = "open" | "waitlist";

export interface Pillar {
  id: PillarId;
  index: string;
  title: string;
  summary: string;
  audience: string;
  outcomes: readonly string[];
  /** Short technical tags rendered in cyan. */
  tags: readonly string[];
  status: PillarStatus;
}
