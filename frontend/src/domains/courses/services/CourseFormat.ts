import type { Course, CourseFaq, CourseModule, EngagementOption, MethodStep, ModulePriority } from "../types";

/** Display rules and defensive parsing for course data. Pure; safe on client and server. */
export class CourseFormat {
  /** The fixed category list; mirrors the CHECK constraint in migration 015_course_cms. */
  static readonly CATEGORIES = [
    "CFA",
    "FRM",
    "Uni Finance",
    "Applied Finance",
    "Business Consultancy",
    "Financial Consultancy",
  ] as const;

  static readonly PRIORITIES = {
    foundation: "Foundation",
    core: "Core",
    high_priority: "High priority",
  } as const;

  private static readonly NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];

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

  /** 3 -> "three"; digits past eight. */
  static count(n: number): string {
    return CourseFormat.NUMBERS[n] ?? String(n);
  }

  static isPriority(value: unknown): value is ModulePriority {
    return typeof value === "string" && Object.hasOwn(CourseFormat.PRIORITIES, value);
  }

  /** "Not another lecture series.\nBring your attempt…" -> headline + body. */
  static splitFirstLine(text: string): { headline: string; body: string } {
    const [headline, ...rest] = text.trim().split("\n");
    return { headline: headline.trim(), body: rest.join("\n").trim() };
  }

  /** "You read first…\nBest for: candidates who…" -> body + the "Best for" line (blank when there is none). */
  /** Midpoint of a weight like "10-15%" or "20%", as a number; null when there is no number. */
  static weightMidpoint(weight: string | undefined): number | null {
    const numbers = (weight ?? "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    if (numbers.length === 0) return null;
    return numbers.length === 1 ? numbers[0] : (numbers[0] + numbers[1]) / 2;
  }

  static splitBestFor(text: string): { body: string; bestFor: string } {
    const [body, bestFor = ""] = text.split(/\n\s*Best for:\s*/i);
    const line = bestFor.trim();
    return { body: body.trim(), bestFor: line.charAt(0).toUpperCase() + line.slice(1) };
  }

  // Defensive readers for the jsonb columns: keep only well-formed items, so one bad row can't break a page.

  static method(value: unknown): MethodStep[] {
    return CourseFormat.items(value, (o) => {
      const title = CourseFormat.str(o.title);
      return title ? { title, description: CourseFormat.str(o.description) } : null;
    });
  }

  static modules(value: unknown): CourseModule[] {
    return CourseFormat.items(value, (o) => {
      const title = CourseFormat.str(o.title);
      if (!title) return null;
      const deliverable = CourseFormat.str(o.deliverable);
      const weight = CourseFormat.str(o.weight);
      return {
        title,
        priority: CourseFormat.isPriority(o.priority) ? o.priority : "core",
        summary: CourseFormat.str(o.summary),
        coaching: CourseFormat.str(o.coaching),
        practice: CourseFormat.str(o.practice),
        ...(deliverable && { deliverable }),
        ...(weight && { weight }),
      };
    });
  }

  static options(value: unknown): EngagementOption[] {
    return CourseFormat.items(value, (o) => {
      const title = CourseFormat.str(o.title);
      if (!title) return null;
      const bookingUrl = CourseFormat.str(o.bookingUrl);
      return { title, description: CourseFormat.str(o.description), fee: CourseFormat.str(o.fee), ...(bookingUrl && { bookingUrl }) };
    });
  }

  static faqs(value: unknown): CourseFaq[] {
    return CourseFormat.items(value, (o) => {
      const question = CourseFormat.str(o.question);
      const answer = CourseFormat.str(o.answer);
      return question && answer ? { question, answer } : null;
    });
  }

  private static str(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private static items<T>(value: unknown, read: (o: Record<string, unknown>) => T | null): T[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const parsed = read(item as Record<string, unknown>);
      return parsed ? [parsed] : [];
    });
  }
}
