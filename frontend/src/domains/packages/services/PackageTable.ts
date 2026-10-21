import { CourseFormat } from "@/domains/courses/services/CourseFormat";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import type { Currency } from "@/domains/invoices/types";

import type { Package, PackageFeature, PackageInput } from "../types";

export type PackageFieldErrors = Partial<Record<keyof PackageInput, string>>;

type Parsed = { ok: true; input: PackageInput } | { ok: false; errors: PackageFieldErrors };

/** Package display rules, the comparison table and the admin form's validation (limits mirror 053). Pure. */
export class PackageTable {
  static readonly LIMITS = { name: [2, 60], tagline: 160, hours: 300, features: 20, label: 60, value: 60 } as const;

  static isCustom(p: Pick<Package, "hours">): boolean {
    return p.hours === null;
  }

  /** "AED 1,500", or "Agreed with you" for Custom. */
  static price(p: Pick<Package, "priceMinor" | "currency">): string {
    return p.priceMinor === null ? "Agreed with you" : CourseFormat.price(p);
  }

  /** "AED 125 / hour"; null for Custom. */
  static perHour(p: Pick<Package, "hours" | "priceMinor" | "currency">): string | null {
    if (p.hours === null || p.priceMinor === null) return null;
    return `${CourseFormat.price({ priceMinor: Math.round(p.priceMinor / p.hours), currency: p.currency })} / hour`;
  }

  /** "12 live hours" / "1 live hour"; Custom: "Hours agreed with you". */
  static hours(p: Pick<Package, "hours">): string {
    return p.hours === null ? "Hours agreed with you" : `${p.hours} live hour${p.hours === 1 ? "" : "s"}`;
  }

  /**
   * The comparison: a feature every priced package has with the same value goes
   * to "Every package includes"; the rest become table rows (in first-seen order),
   * one value per package ("" = not included).
   */
  static compare(packages: readonly Package[]): { common: PackageFeature[]; rows: { label: string; values: string[] }[] } {
    const priced = packages.filter((p) => !PackageTable.isCustom(p));
    const labels = [...new Set(priced.flatMap((p) => p.features.map((f) => f.label)))];
    const valueOf = (p: Package, label: string) => p.features.find((f) => f.label === label)?.value ?? "";
    const common: PackageFeature[] = [];
    const rows: { label: string; values: string[] }[] = [];
    for (const label of labels) {
      const values = priced.map((p) => valueOf(p, label));
      if (values.every((v) => v !== "" && v === values[0])) common.push({ label, value: values[0] });
      else rows.push({ label, values });
    }
    return { common, rows };
  }

  /** The packages a course offers: all for an exam course, otherwise only Custom. */
  static forCourse<T extends Pick<Package, "hours">>(packages: readonly T[], exam: boolean): T[] {
    return exam ? [...packages] : packages.filter((p) => PackageTable.isCustom(p));
  }

  /** The owner's "New student joined" email row: what was picked, and what is left to do. */
  static noticeRows(p: Package | null): [string, string][] {
    if (!p) return [];
    if (PackageTable.isCustom(p)) return [["Package", `${p.name}: agree the terms on WhatsApp, then send their agreement`]];
    return [["Package", `${p.name}, ${PackageTable.hours(p)} for ${PackageTable.price(p)}: their agreement is created; send the invoice`]];
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

    const custom = text("custom") === "yes";
    let hours: number | null = null;
    let priceMinor: number | null = null;
    if (!custom) {
      hours = Number(text("hours"));
      if (!Number.isInteger(hours) || hours < 1 || hours > LIMITS.hours) errors.hours = `Whole hours, 1 to ${LIMITS.hours}.`;
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
      input: { name, tagline, hours, priceMinor, currency, features, position, featured: text("featured") === "yes", isActive: text("isActive") === "yes" },
    };
  }
}
