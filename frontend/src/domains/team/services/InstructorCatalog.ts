import type { Instructor } from "../types";

/**
 * The teaching team shown on /about, in scroll order.
 *
 * TODO: replace every `placeholder: true` profile with real copy and drop a
 * photo into /public/team/ before launch. Do not publish invented credentials.
 */
export class InstructorCatalog {
  private static readonly INSTRUCTORS: readonly Instructor[] = [
    {
      id: "instructor-1",
      name: "Muhammad Ahmed Raza",
      role: "Founder · Lead Instructor",
      bio: "Muhammad Ahmed Raza teaches financial theory through exam-style practice and practical implementation. His approach connects CFA and FRM concepts with valuation, risk models, Python workflows and real-world financial analysis.",
      education: ["MSc Data Science", "CFA Level III Candidate", "FRM Part I Passed"],
      background:
        "Builds the in-house quant engine behind the site's pricing, risk and portfolio tools, and uses it in every 1-on-1 session.",
      highlights: ["CFA®", "FRM®", "Python", "Risk & VaR"],
      placeholder: true,
    },
  ];

  all(): readonly Instructor[] {
    return InstructorCatalog.INSTRUCTORS;
  }
}
