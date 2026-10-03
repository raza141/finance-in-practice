import type { Course, SyllabusModule } from "../types";

/** Display rules and defensive parsing for course data. Pure; safe on client and server. */
export class CourseFormat {
  /** The fixed category list; mirrors the CHECK constraint in migration 003_courses. */
  static readonly CATEGORIES = [
    "Portfolio Construction",
    "Fixed Income",
    "Quantitative Finance",
    "Risk Management",
    "Wealth Management",
    "Financial Modeling",
    "Exam Prep",
  ] as const;

  static price(course: Pick<Course, "priceMinor" | "currency">): string {
    if (course.priceMinor === null) return "On request";
    if (course.priceMinor === 0) return "Free";
    const amount = course.priceMinor / 100;
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: course.currency,
      // "AED 4,500" / "USD 999.50": a bare "$" is ambiguous for a Dubai audience.
      currencyDisplay: "code",
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  }

  /** "12 January 2027", or "On request". Dates are calendar dates, so format in UTC. */
  static startDate(iso: string | null): string {
    if (!iso) return "On request";
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  }

  /** Keep only well-formed modules, so one bad JSON edit can't break the page. */
  static syllabus(value: unknown): SyllabusModule[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): SyllabusModule[] => {
      if (typeof item !== "object" || item === null) return [];
      const { title, summary, topics } = item as Record<string, unknown>;
      if (typeof title !== "string" || !title.trim()) return [];
      return [
        {
          title: title.trim(),
          ...(typeof summary === "string" && summary.trim() ? { summary: summary.trim() } : {}),
          topics: Array.isArray(topics)
            ? topics.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim())
            : [],
        },
      ];
    });
  }

  static topicCount(syllabus: readonly SyllabusModule[]): number {
    return syllabus.reduce((sum, module) => sum + module.topics.length, 0);
  }
}
