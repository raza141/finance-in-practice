/** A testimonial as shown publicly. Never carries the author's email. */
export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  /** Who they are, e.g. "CFA Level II candidate" or "MSc Finance, LSE". */
  context: string;
  /** Course or service they took, shown as a chip. */
  program: string;
  /** Optional outcome line, e.g. "Passed CFA Level I, May 2026". */
  outcome?: string;
}

export type TestimonialStatus = "pending" | "approved" | "rejected";

/** Full row for the admin moderation queue. */
export interface TestimonialRecord extends Testimonial {
  email: string;
  status: TestimonialStatus;
  consentAt: string;
  submittedAt: string;
  reviewedAt: string | null;
}
