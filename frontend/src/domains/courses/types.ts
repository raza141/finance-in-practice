import type { Ticker } from "@/domains/testimonials/types";

import type { CourseFormat } from "./services/CourseFormat";

export type CourseCategory = (typeof CourseFormat.CATEGORIES)[number];
export type ModulePriority = keyof typeof CourseFormat.PRIORITIES;

/** One stage of the coaching method, e.g. "Prepare". */
export interface MethodStep {
  title: string;
  description: string;
}

/** One curriculum module. The two labelled lines use the course's coachingLabel / practiceLabel. */
export interface CourseModule {
  title: string;
  priority: ModulePriority;
  /** One-line outcome. */
  summary: string;
  coaching: string;
  practice: string;
  deliverable?: string;
  /** Share of the exam, e.g. "10–15%"; shown after the course's weightLabel. */
  weight?: string;
}

/** A way to study a topic, e.g. "Self-study" or "Study with me". Same shape as a method step. */
export type LearningMode = MethodStep;

/** A way to buy, e.g. "Single session" or "Full-level programme". */
export interface EngagementOption {
  title: string;
  description: string;
  /** Free text, e.g. "AED 450 per session" or "On request". */
  fee: string;
  /** Overrides the course's booking link for this option. */
  bookingUrl?: string;
}

export interface CourseFaq {
  question: string;
  answer: string;
}

/** A course as served on /courses/[slug] and edited in /admin/courses. Holds no admin-only data. */
export interface Course {
  id: string;
  slug: string;
  title: string;
  category: CourseCategory;
  /** Small label above the title; blank shows the category. */
  eyebrow: string;
  /** Short italic line under the title, e.g. "Learn it by doing it."; blank hides it. */
  tagline: string;
  /** Positioning statement, shown under the title and on course cards. */
  summary: string;
  audience: string;
  notFor: string;
  /** What makes it different. The first line is the headline. */
  difference: string;
  disclaimer: string;
  ctaLabel: string;
  /** "#book" (the on-page booking panel), a site path, or an https URL. */
  bookingUrl: string;
  coachingLabel: string;
  practiceLabel: string;
  /** Label before each module's weight, e.g. "Official weight (2027)". */
  weightLabel: string;
  /** ISO date (YYYY-MM-DD); null when the next start date is on request. */
  startDate: string | null;
  /** Free text, e.g. "1-on-1 · flexible schedule". */
  duration: string;
  /** Headline fee in minor units (fils, cents); null when on request. Invoices and client plans pick it up. */
  priceMinor: number | null;
  currency: string;
  isActive: boolean;
  method: MethodStep[];
  /** Shown under the method as "N ways to learn"; empty hides it. */
  modes: LearningMode[];
  modules: CourseModule[];
  options: EngagementOption[];
  faqs: CourseFaq[];
  brochureUrl: string | null;
  seoTitle: string;
  seoDescription: string;
  /** Approved testimonials with this ticker show on the page. */
  testimonialTicker: Ticker | null;
}
