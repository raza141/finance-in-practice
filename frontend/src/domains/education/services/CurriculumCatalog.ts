import type { Pillar, PillarId } from "../types";

/**
 * Read model for the academy's service pillars. Static today; swap the data
 * source for the LMS/CMS later without touching components.
 */
export class CurriculumCatalog {
  private static readonly PILLARS: readonly Pillar[] = [
    {
      id: "exam-prep",
      index: "01",
      title: "CFA® & FRM® Exam Prep",
      summary:
        "Structured preparation for CFA Level I & II and FRM Part I, with every quantitative topic taught through worked problems and working code.",
      audience: "CFA L1 · L2 and FRM P1 candidates",
      outcomes: ["Personal study plan", "Exam-style problem drills", "Formula intuition, not rote"],
      tags: ["Fixed income", "Derivatives", "Quant methods"],
      status: "open",
    },
    {
      id: "university",
      index: "02",
      title: "University Mentorship",
      summary:
        "1-on-1 support for corporate finance, investments and econometrics courses, from problem sets to dissertations and finance interviews.",
      audience: "Undergraduate & postgraduate finance students",
      outcomes: ["Coursework clarity", "Dissertation guidance", "Interview preparation"],
      tags: ["Corporate finance", "Econometrics"],
      status: "open",
    },
    {
      id: "automation",
      index: "03",
      title: "Financial Automation & Python Systems",
      summary:
        "Turn spreadsheets into systems: build pricing, VaR and portfolio tools in Python, validated against textbook values.",
      audience: "Analysts, students and teams moving beyond Excel",
      outcomes: ["Production-quality Python", "Tested quant models", "Reusable analytics tools"],
      tags: ["Python", "pandas", "NumPy", "SciPy"],
      status: "open",
    },
    {
      id: "lms",
      index: "04",
      title: "On-Demand Learning Platform",
      summary:
        "Self-paced courses with interactive quant labs that run on the same engine as the 1-on-1 sessions.",
      audience: "Self-directed learners",
      outcomes: ["Video lessons", "Interactive calculators", "Progress tracking"],
      tags: ["Self-paced", "Quant labs"],
      status: "waitlist",
    },
  ];

  all(): readonly Pillar[] {
    return CurriculumCatalog.PILLARS;
  }

  byId(id: PillarId): Pillar | undefined {
    return CurriculumCatalog.PILLARS.find((pillar) => pillar.id === id);
  }
}
