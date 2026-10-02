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
      bio: "Teaches financial theory the way practitioners use it: every concept is derived, drilled on exam-style problems, then implemented in Python.",
      education: ["MSc Data Science", "CFA Level III Candidate", "FRM Part I Passed"],
      background:
        "Builds the in-house quant engine behind the site's pricing, risk and portfolio tools, and uses it in every 1-on-1 session.",
      highlights: ["CFA®", "FRM®", "Python", "Risk & VaR"],
      placeholder: true,
    },
    {
      id: "instructor-2",
      name: "Instructor Two",
      role: "Instructor · Financial Modeling",
      bio: "Placeholder bio. Two or three sentences on teaching style and what students walk away with.",
      education: ["Degree, University", "Professional certification"],
      background: "Placeholder background. Industry experience, previous roles and areas of expertise.",
      highlights: ["Valuation", "Excel", "Corporate finance"],
      placeholder: true,
    },
    {
      id: "instructor-3",
      name: "Instructor Three",
      role: "Instructor · Automation",
      bio: "Placeholder bio. Two or three sentences on teaching style and what students walk away with.",
      education: ["Degree, University", "Professional certification"],
      background: "Placeholder background. Industry experience, previous roles and areas of expertise.",
      highlights: ["Python", "Data pipelines", "Reporting"],
      placeholder: true,
    },
  ];

  all(): readonly Instructor[] {
    return InstructorCatalog.INSTRUCTORS;
  }
}
