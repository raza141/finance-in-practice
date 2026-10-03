import type { CourseCategory, SyllabusModule } from "../types";
import { CourseFormat } from "./CourseFormat";

/** What the admin course form saves. Mirrors the columns of 003_courses. */
export interface CourseInput {
  slug: string;
  title: string;
  summary: string;
  category: CourseCategory;
  startDate: string | null;
  duration: string;
  priceMinor: number | null;
  currency: string;
  isActive: boolean;
  syllabus: SyllabusModule[];
  brochureUrl: string | null;
}

export type CourseField = keyof CourseInput;
export type CourseFieldErrors = Partial<Record<CourseField, string>>;
export type CourseParseResult = { ok: true; input: CourseInput } | { ok: false; errors: CourseFieldErrors };

/**
 * Validation for the admin course form. The same limits are enforced by the
 * database CHECK constraints; checking here gives per-field messages instead
 * of a constraint error.
 */
export class CourseContract {
  static readonly CURRENCIES = ["AED", "USD", "GBP", "EUR", "PKR", "SAR"] as const;
  static readonly LIMITS = {
    title: [3, 120],
    summary: [20, 600],
    duration: [2, 40],
    slug: 80,
    modules: 30,
    topics: 30,
    text: 160,
    /** 10 million in major units. */
    priceMinor: 1_000_000_000,
  } as const;

  private static readonly SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  private static readonly DATE = /^\d{4}-\d{2}-\d{2}$/;
  private static readonly BROCHURE = /^\/brochures\/[A-Za-z0-9._-]+\.pdf$/;
  private static readonly PRICE = /^\d+(\.\d{1,2})?$/;

  /** "Portfolio Construction & ML" -> "portfolio-construction-ml". */
  static slugify(title: string): string {
    return title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, CourseContract.LIMITS.slug)
      .replace(/-+$/, "");
  }

  static isCategory(value: unknown): value is CourseCategory {
    return (CourseFormat.CATEGORIES as readonly unknown[]).includes(value);
  }

  /** Major units as typed ("4,500", "999.50") -> minor units; "" -> null (on request). */
  static parsePrice(raw: string): number | null | "invalid" {
    const cleaned = raw.replace(/[\s,]/g, "");
    if (cleaned === "") return null;
    if (!CourseContract.PRICE.test(cleaned)) return "invalid";
    const [whole, fraction = ""] = cleaned.split(".");
    const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    return minor <= CourseContract.LIMITS.priceMinor ? minor : "invalid";
  }

  /** Minor units -> the text shown in the form's price field. */
  static priceInput(minor: number | null): string {
    if (minor === null) return "";
    return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
  }

  static parse(fields: Record<string, unknown>): CourseParseResult {
    const text = (name: string) => (typeof fields[name] === "string" ? (fields[name] as string).trim() : "");
    const errors: CourseFieldErrors = {};
    const { LIMITS } = CourseContract;

    const title = text("title");
    if (title.length < LIMITS.title[0] || title.length > LIMITS.title[1]) {
      errors.title = `Use ${LIMITS.title[0]}–${LIMITS.title[1]} characters.`;
    }

    const slug = text("slug").toLowerCase();
    if (!CourseContract.SLUG.test(slug) || slug.length > LIMITS.slug) {
      errors.slug = "Lowercase letters, numbers and single hyphens only, e.g. fixed-income-essentials.";
    }

    const summary = text("summary");
    if (summary.length < LIMITS.summary[0] || summary.length > LIMITS.summary[1]) {
      errors.summary = `Use ${LIMITS.summary[0]}–${LIMITS.summary[1]} characters.`;
    }

    const category = text("category");
    if (!CourseContract.isCategory(category)) errors.category = "Choose a category.";

    const startDate = text("startDate");
    if (startDate && !CourseContract.isRealDate(startDate)) errors.startDate = "Enter a valid date, or leave it blank.";

    const duration = text("duration");
    if (duration.length < LIMITS.duration[0] || duration.length > LIMITS.duration[1]) {
      errors.duration = `Use ${LIMITS.duration[0]}–${LIMITS.duration[1]} characters, e.g. "8 weeks · 16 live sessions".`;
    }

    const priceMinor = CourseContract.parsePrice(text("price"));
    if (priceMinor === "invalid") errors.priceMinor = "Enter an amount like 4500 or 999.50, or leave it blank.";

    const currency = text("currency").toUpperCase() || "AED";
    if (!/^[A-Z]{3}$/.test(currency)) errors.currency = "Use a 3-letter currency code.";

    const brochureUrl = text("brochureUrl");
    if (brochureUrl && !CourseContract.BROCHURE.test(brochureUrl)) {
      errors.brochureUrl = "Use a file in public/brochures/, e.g. /brochures/fixed-income.pdf.";
    }

    const syllabus = CourseContract.parseSyllabus(text("syllabus"));
    if (typeof syllabus === "string") errors.syllabus = syllabus;

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return {
      ok: true,
      input: {
        slug,
        title,
        summary,
        category: category as CourseCategory,
        startDate: startDate || null,
        duration,
        priceMinor: priceMinor as number | null,
        currency,
        isActive: fields.isActive === "on" || fields.isActive === "true",
        syllabus: syllabus as SyllabusModule[],
        brochureUrl: brochureUrl || null,
      },
    };
  }

  private static isRealDate(value: string): boolean {
    if (!CourseContract.DATE.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }

  /** JSON from the syllabus editor -> modules, or an error message. */
  private static parseSyllabus(raw: string): SyllabusModule[] | string {
    if (!raw) return [];
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return "The curriculum could not be read. Reload the page and try again.";
    }
    const modules = CourseFormat.syllabus(value);
    const { LIMITS } = CourseContract;
    if (modules.length > LIMITS.modules) return `At most ${LIMITS.modules} modules.`;
    for (const [index, module] of modules.entries()) {
      const label = `Module ${index + 1}`;
      if (module.title.length > LIMITS.text) return `${label}: title is longer than ${LIMITS.text} characters.`;
      if ((module.summary?.length ?? 0) > 600) return `${label}: summary is longer than 600 characters.`;
      if (module.topics.length > LIMITS.topics) return `${label}: at most ${LIMITS.topics} topics.`;
      if (module.topics.some((topic) => topic.length > LIMITS.text)) {
        return `${label}: each topic must be under ${LIMITS.text} characters.`;
      }
    }
    return modules;
  }
}
