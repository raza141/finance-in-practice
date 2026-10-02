import type { Testimonial } from "../types";

/**
 * Student testimonials shown on the landing page, in scroll order.
 *
 * TODO: replace every `placeholder: true` entry with a real, attributable
 * student quote (with their permission) before launch. Do not publish
 * invented testimonials or outcomes.
 */
export class TestimonialCatalog {
  private static readonly TESTIMONIALS: readonly Testimonial[] = [
    {
      id: "testimonial-1",
      quote:
        "Placeholder testimonial. Two or three sentences in the student's own words on what changed for them.",
      author: "Student Name",
      context: "CFA Level I candidate",
      program: "Exam prep",
      outcome: "Placeholder outcome",
      placeholder: true,
    },
    {
      id: "testimonial-2",
      quote:
        "Placeholder testimonial. Two or three sentences in the student's own words on what changed for them.",
      author: "Student Name",
      context: "MSc Finance student",
      program: "University finance",
      placeholder: true,
    },
    {
      id: "testimonial-3",
      quote:
        "Placeholder testimonial. Two or three sentences in the student's own words on what changed for them.",
      author: "Student Name",
      context: "Risk analyst",
      program: "Stress testing & VaR",
      placeholder: true,
    },
  ];

  all(): readonly Testimonial[] {
    return TestimonialCatalog.TESTIMONIALS;
  }
}
