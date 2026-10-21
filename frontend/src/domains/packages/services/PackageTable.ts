import { CourseFormat } from "@/domains/courses/services/CourseFormat";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import type { Currency } from "@/domains/invoices/types";

import type { Package, PackageAudience, PackageBilling, PackageFeature, PackageInput } from "../types";

export type PackageFieldErrors = Partial<Record<keyof PackageInput, string>>;

type Parsed = { ok: true; input: PackageInput } | { ok: false; errors: PackageFieldErrors };

/**
 * Which packages a course gets: exam courses the exam packages (with Custom),
 * university courses the university ones, anything else only Custom. "open" is
 * a subject typed by the student (registration can't tell): university or Custom.
 */
export type CourseGroup = PackageAudience | "other" | "open";

/** Package display rules, the comparison and the admin form's validation (limits mirror 053–054). Pure. */
export class PackageTable {
  static readonly LIMITS = { name: [2, 60], tagline: 160, hours: 300, features: 20, label: 60, value: 60 } as const;
  static readonly BILLING: Record<PackageBilling, string> = { package: "Hours for one price", hour: "By the hour", month: "By the month" };
  static readonly AUDIENCE: Record<PackageAudience, string> = { exam: "Exam courses (CFA, FRM)", university: "University courses" };
  /** The course category that takes the university packages (CourseFormat.CATEGORIES). */
  static readonly UNIVERSITY_CATEGORY = "Uni Finance";

  static isCustom(p: Pick<Package, "priceMinor">): boolean {
    return p.priceMinor === null;
  }

  /** "AED 1,500", or "Agreed with you" for Custom. */
  static price(p: Pick<Package, "priceMinor" | "currency">): string {
    return p.priceMinor === null ? "Agreed with you" : CourseFormat.price(p);
  }

  /** What the price is for: "/ hour", "/ month", or "" for a package total. */
  static per(p: Pick<Package, "billing" | "priceMinor">): string {
    if (p.priceMinor === null) return "";
    return p.billing === "hour" ? "/ hour" : p.billing === "month" ? "/ month" : "";
  }

  /** "AED 125 / hour" for a package of more than one hour; null otherwise. */
  static perHour(p: Pick<Package, "billing" | "hours" | "priceMinor" | "currency">): string | null {
    if (p.billing !== "package" || p.hours === null || p.hours < 2 || p.priceMinor === null) return null;
    return `${CourseFormat.price({ priceMinor: Math.round(p.priceMinor / p.hours), currency: p.currency })} / hour`;
  }

  /** "12 live hours", "20 live hours a month", "No minimum" (hourly), or "Hours agreed with you". */
  static hours(p: Pick<Package, "billing" | "hours" | "priceMinor">): string {
    if (p.priceMinor === null) return "Hours agreed with you";
    if (p.billing === "hour" || p.hours === null) return "No minimum";
    return `${p.hours} live hour${p.hours === 1 ? "" : "s"}${p.billing === "month" ? " a month" : ""}`;
  }

  /** "AED 1,500 for 12 live hours", for emails and lists. */
  static summary(p: Package): string {
    return PackageTable.isCustom(p) ? p.name : `${p.name}: ${PackageTable.price(p)} ${PackageTable.per(p)}, ${PackageTable.hours(p).toLowerCase()}`.replace(/\s+,/, ",");
  }

  /**
   * A feature every priced package has with the same value goes to "Every package
   * includes"; the rest stay on each card, only where that package includes it.
   */
  static compare(packages: readonly Package[]): { common: PackageFeature[]; own: Map<string, PackageFeature[]> } {
    const priced = packages.filter((p) => !PackageTable.isCustom(p));
    const valueOf = (p: Package, label: string) => p.features.find((f) => f.label === label)?.value ?? "";
    const common = priced.length < 2 ? [] : (priced[0]?.features ?? []).filter((f) => f.value !== "" && priced.every((p) => valueOf(p, f.label) === f.value));
    const shared = new Set(common.map((f) => f.label));
    const own = new Map(priced.map((p) => [p.id, p.features.filter((f) => f.value !== "" && !shared.has(f.label))]));
    return { common, own };
  }

  /** Exam if the course has exam sittings, university by category, otherwise other. */
  static groupOf(course: { sittings?: readonly string[]; category?: string }): CourseGroup {
    if ((course.sittings?.length ?? 0) > 0) return "exam";
    return course.category === PackageTable.UNIVERSITY_CATEGORY ? "university" : "other";
  }

  static forCourse<T extends Pick<Package, "priceMinor" | "audience">>(packages: readonly T[], group: CourseGroup): T[] {
    return packages.filter((p) => {
      const custom = PackageTable.isCustom(p);
      if (group === "exam") return p.audience === "exam";
      if (group === "university") return p.audience === "university";
      if (group === "open") return custom || p.audience === "university";
      return custom;
    });
  }

  /** The owner's "New student joined" email row: what was picked, and what is left to do. */
  static noticeRows(p: Package | null): [string, string][] {
    if (!p) return [];
    if (PackageTable.isCustom(p)) return [["Package", `${p.name}: agree the details on WhatsApp, then send their agreement`]];
    return [["Package", `${PackageTable.summary(p)}. Their agreement is in their portal to accept; confirm on WhatsApp and send the invoice`]];
  }

  /** "Label: value" per line, as the admin textarea shows them. */
  static featureText(features: readonly PackageFeature[]): string {
    return features.map((f) => (f.value ? `${f.label}: ${f.value}` : f.label)).join("\n");
  }

  static parse(fields: Record<string, unknown>): Parsed {
    const { LIMITS } = PackageTable;
    const text = (name: string) => (typeof fields[name] === "string" ? (fields[name] as string).trim() : "");
    const errors: PackageFieldErrors = {};

    const name = text("name");
    if (name.length < LIMITS.name[0] || name.length > LIMITS.name[1]) errors.name = `${LIMITS.name[0]}–${LIMITS.name[1]} characters.`;
    const tagline = text("tagline");
    if (tagline.length > LIMITS.tagline) errors.tagline = `Up to ${LIMITS.tagline} characters.`;

    const billing = text("billing") as PackageBilling;
    if (!(billing in PackageTable.BILLING)) errors.billing = "Choose how it is billed.";
    const audience = text("audience") as PackageAudience;
    if (!(audience in PackageTable.AUDIENCE)) errors.audience = "Choose who it is for.";

    const custom = text("custom") === "yes";
    let hours: number | null = null;
    let priceMinor: number | null = null;
    if (!custom) {
      if (billing !== "hour") {
        hours = Number(text("hours"));
        if (!Number.isInteger(hours) || hours < 1 || hours > LIMITS.hours) errors.hours = `Whole hours, 1 to ${LIMITS.hours}.`;
      }
      priceMinor = InvoiceMath.parseMajor(text("price"));
      if (!priceMinor) errors.priceMinor = "Enter the price, e.g. 1500.";
    }
    const currency = text("currency") as Currency;
    if (!InvoiceContract.CURRENCIES.includes(currency)) errors.currency = "Choose a currency.";

    const lines = text("features").split("\n").map((l) => l.trim()).filter(Boolean);
    const features = lines.map((line) => {
      const at = line.indexOf(":");
      return at < 0 ? { label: line, value: "" } : { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
    });
    if (features.length > LIMITS.features) errors.features = `Up to ${LIMITS.features} lines.`;
    else if (features.some((f) => !f.label || f.label.length > LIMITS.label || f.value.length > LIMITS.value)) {
      errors.features = `One "Feature: what's included" per line, each part up to ${LIMITS.label} characters.`;
    } else if (new Set(features.map((f) => f.label)).size < features.length) errors.features = "Each feature once.";

    const position = Number(text("position") || "0");
    if (!Number.isInteger(position) || Math.abs(position) > 1000) errors.position = "A whole number, e.g. 1.";

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return {
      ok: true,
      input: {
        name,
        tagline,
        hours,
        priceMinor,
        currency,
        billing: custom ? "package" : billing,
        audience,
        features,
        position,
        featured: text("featured") === "yes",
        isActive: text("isActive") === "yes",
      },
    };
  }
}
