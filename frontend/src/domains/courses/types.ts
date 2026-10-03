import type { CourseFormat } from "./services/CourseFormat";

export type CourseCategory = (typeof CourseFormat.CATEGORIES)[number];

export interface SyllabusModule {
  title: string;
  summary?: string;
  topics: string[];
}

/** A published course, as served on /courses/[slug]. */
export interface Course {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: CourseCategory;
  /** ISO date (YYYY-MM-DD); null when the next start date is on request. */
  startDate: string | null;
  /** Free text, e.g. "8 weeks · 16 live sessions". */
  duration: string;
  /** Fee in minor units (fils, cents); null when the price is on request. */
  priceMinor: number | null;
  /** ISO 4217 code; the database defaults it to "AED". */
  currency: string;
  isActive: boolean;
  syllabus: SyllabusModule[];
  brochureUrl: string | null;
}
