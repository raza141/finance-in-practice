import { TestimonialContract } from "@/domains/testimonials/services/TestimonialContract";

import type { Course, CourseCategory, CourseFaq, CourseModule, EngagementOption, MethodStep } from "../types";
import { CourseFormat } from "./CourseFormat";

/** What the course editor saves: every course field except the id and the published flag. */
export type CourseInput = Omit<Course, "id" | "isActive">;

/** Keyed by field name; list errors use the list name (method, modules, options, faqs). */
export type CourseFieldErrors = Partial<Record<keyof CourseInput, string>>;
export type CourseParseResult = { ok: true; input: CourseInput } | { ok: false; errors: CourseFieldErrors };

/**
 * Validation for the course editor. The editor posts the whole course as one
 * JSON object; the same limits are enforced by the database CHECK constraints
 * (migrations 003 and 015). Checking here gives per-field messages instead.
 */
export class CourseContract {
  static readonly CURRENCIES = ["AED", "USD", "GBP", "EUR", "PKR", "SAR"] as const;
  static readonly LIMITS = {
    title: [3, 120],
    summary: [20, 600],
    duration: [2, 40],
    label: [2, 40],
    slug: 80,
    eyebrow: 40,
    prose: 800,
    url: 500,
    seoTitle: 70,
    seoDescription: 170,
    method: 6,
    modules: 40,
    options: 6,
    faqs: 20,
    /** 10 million in major units. */
    priceMinor: 1_000_000_000,
  } as const;

  private static readonly SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  private static readonly DATE = /^\d{4}-\d{2}-\d{2}$/;
  private static readonly PRICE = /^\d+(\.\d{1,2})?$/;
  /** On-page anchor, site path or https URL. Mirrors courses_booking_url_check. */
  private static readonly LINK = /^(#[a-z0-9-]+|\/[A-Za-z0-9/_?=&.#-]*|https:\/\/\S+)$/;
  /** A PDF in public/brochures/ or an uploaded (Blob) https URL. Mirrors courses_brochure_url_check. */
  private static readonly BROCHURE = /^(\/brochures\/[A-Za-z0-9._-]+\.pdf|https:\/\/\S+\.pdf)$/;

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

  static isLink(value: string): boolean {
    return value.length <= CourseContract.LIMITS.url && CourseContract.LINK.test(value);
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

  /** Minor units -> the text shown in the editor's price field. */
  static priceInput(minor: number | null): string {
    if (minor === null) return "";
    return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
  }

  /** The editor's payload (price as typed, in `price`) -> a course, or per-field errors. */
  static parse(raw: unknown): CourseParseResult {
    const fields = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const text = (name: string) => (typeof fields[name] === "string" ? (fields[name] as string).trim() : "");
    const errors: CourseFieldErrors = {};
    const { LIMITS } = CourseContract;
    const within = (field: keyof CourseInput, value: string, min: number, max: number, hint = "") => {
      if (value.length < min || value.length > max) {
        errors[field] = min > 0 ? `Use ${min}–${max} characters.${hint}` : `Keep it under ${max} characters.`;
      }
    };

    const title = text("title");
    within("title", title, ...LIMITS.title);

    const slug = text("slug").toLowerCase();
    if (!CourseContract.SLUG.test(slug) || slug.length > LIMITS.slug) {
      errors.slug = "Lowercase letters, numbers and single hyphens only, e.g. cfa-level-1.";
    }

    const category = text("category");
    if (!CourseContract.isCategory(category)) errors.category = "Choose a category.";

    const summary = text("summary");
    within("summary", summary, ...LIMITS.summary);
    const eyebrow = text("eyebrow");
    within("eyebrow", eyebrow, 0, LIMITS.eyebrow);
    const prose = {
      audience: text("audience"),
      notFor: text("notFor"),
      difference: text("difference"),
      disclaimer: text("disclaimer"),
    };
    for (const [field, value] of Object.entries(prose)) within(field as keyof CourseInput, value, 0, LIMITS.prose);

    const ctaLabel = text("ctaLabel");
    within("ctaLabel", ctaLabel, ...LIMITS.label);
    const coachingLabel = text("coachingLabel");
    within("coachingLabel", coachingLabel, ...LIMITS.label);
    const practiceLabel = text("practiceLabel");
    within("practiceLabel", practiceLabel, ...LIMITS.label);

    const bookingUrl = text("bookingUrl") || "#book";
    if (!CourseContract.isLink(bookingUrl)) errors.bookingUrl = "Use #book, a site path like /contact, or an https:// link.";

    const startDate = text("startDate");
    if (startDate && !CourseContract.isRealDate(startDate)) errors.startDate = "Enter a valid date, or leave it blank.";

    const duration = text("duration");
    within("duration", duration, ...LIMITS.duration, ' e.g. "1-on-1 · flexible schedule".');

    const priceMinor = CourseContract.parsePrice(text("price"));
    if (priceMinor === "invalid") errors.priceMinor = "Enter an amount like 4500 or 999.50, or leave it blank.";

    const currency = text("currency").toUpperCase() || "AED";
    if (!/^[A-Z]{3}$/.test(currency)) errors.currency = "Use a 3-letter currency code.";

    const brochureUrl = text("brochureUrl");
    if (brochureUrl && (brochureUrl.length > LIMITS.url || !CourseContract.BROCHURE.test(brochureUrl))) {
      errors.brochureUrl = "Upload a PDF, or use a file in public/brochures/, e.g. /brochures/cfa-level-1.pdf.";
    }

    const seoTitle = text("seoTitle");
    within("seoTitle", seoTitle, 0, LIMITS.seoTitle);
    const seoDescription = text("seoDescription");
    within("seoDescription", seoDescription, 0, LIMITS.seoDescription);

    const ticker = text("testimonialTicker");
    if (ticker && !TestimonialContract.isTicker(ticker)) errors.testimonialTicker = "Choose a testimonial ticker.";

    const method = CourseContract.list(fields.method, LIMITS.method, "Step", CourseContract.methodStep);
    const modules = CourseContract.list(fields.modules, LIMITS.modules, "Module", CourseContract.module);
    const options = CourseContract.list(fields.options, LIMITS.options, "Option", CourseContract.option);
    const faqs = CourseContract.list(fields.faqs, LIMITS.faqs, "FAQ", CourseContract.faq);
    for (const [field, value] of Object.entries({ method, modules, options, faqs })) {
      if (typeof value === "string") errors[field as keyof CourseInput] = value;
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return {
      ok: true,
      input: {
        slug,
        title,
        category: category as CourseCategory,
        eyebrow,
        summary,
        ...prose,
        ctaLabel,
        bookingUrl,
        coachingLabel,
        practiceLabel,
        startDate: startDate || null,
        duration,
        priceMinor: priceMinor as number | null,
        currency,
        method: method as MethodStep[],
        modules: modules as CourseModule[],
        options: options as EngagementOption[],
        faqs: faqs as CourseFaq[],
        brochureUrl: brochureUrl || null,
        seoTitle,
        seoDescription,
        testimonialTicker: ticker ? (ticker as CourseInput["testimonialTicker"]) : null,
      },
    };
  }

  /** What a draft still needs before it can go live; empty when it is ready. */
  static publishProblems(input: Pick<CourseInput, "method" | "modules">): CourseFieldErrors {
    const problems: CourseFieldErrors = {};
    if (input.method.length === 0) problems.method = "Add at least one method step before publishing.";
    if (input.modules.length === 0) problems.modules = "Add at least one module before publishing.";
    return problems;
  }

  private static isRealDate(value: string): boolean {
    if (!CourseContract.DATE.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }

  /** An array of items -> parsed items, or the first problem as a message. */
  private static list<T>(
    value: unknown,
    max: number,
    noun: string,
    read: (o: Record<string, string>) => T | string,
  ): T[] | string {
    if (value === undefined) return [];
    if (!Array.isArray(value)) return `The ${noun.toLowerCase()} list could not be read. Reload the page and try again.`;
    if (value.length > max) return `At most ${max} items.`;
    const parsed: T[] = [];
    for (const [index, item] of value.entries()) {
      const o: Record<string, string> = {};
      if (typeof item === "object" && item !== null) {
        for (const [k, v] of Object.entries(item)) if (typeof v === "string") o[k] = v.trim();
      }
      const result = read(o);
      if (typeof result === "string") return `${noun} ${index + 1}: ${result}`;
      parsed.push(result);
    }
    return parsed;
  }

  /** Field -> [required, max length]; returns the first problem, or null. */
  private static check(o: Record<string, string>, rules: Record<string, [boolean, number]>): string | null {
    for (const [field, [required, max]] of Object.entries(rules)) {
      const value = o[field] ?? "";
      const name = field.replace(/([A-Z])/g, " $1").toLowerCase();
      if (required && !value) return `${name} is required.`;
      if (value.length > max) return `${name} must be under ${max} characters.`;
    }
    return null;
  }

  private static methodStep(o: Record<string, string>): MethodStep | string {
    return CourseContract.check(o, { title: [true, 80], description: [false, 400] }) ?? { title: o.title, description: o.description ?? "" };
  }

  private static module(o: Record<string, string>): CourseModule | string {
    const problem = CourseContract.check(o, {
      title: [true, 160],
      summary: [false, 300],
      coaching: [false, 600],
      practice: [false, 600],
      deliverable: [false, 300],
    });
    if (problem) return problem;
    if (!CourseFormat.isPriority(o.priority)) return "choose a priority.";
    return {
      title: o.title,
      priority: o.priority,
      summary: o.summary ?? "",
      coaching: o.coaching ?? "",
      practice: o.practice ?? "",
      ...(o.deliverable && { deliverable: o.deliverable }),
    };
  }

  private static option(o: Record<string, string>): EngagementOption | string {
    const problem = CourseContract.check(o, { title: [true, 80], description: [false, 400], fee: [false, 60] });
    if (problem) return problem;
    if (o.bookingUrl && !CourseContract.isLink(o.bookingUrl)) return "booking link must be #book, a site path or an https:// link.";
    return { title: o.title, description: o.description ?? "", fee: o.fee ?? "", ...(o.bookingUrl && { bookingUrl: o.bookingUrl }) };
  }

  private static faq(o: Record<string, string>): CourseFaq | string {
    return CourseContract.check(o, { question: [true, 200], answer: [true, 1200] }) ?? { question: o.question, answer: o.answer };
  }
}
