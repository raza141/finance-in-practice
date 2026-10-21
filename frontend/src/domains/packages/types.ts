import type { Currency } from "@/domains/invoices/types";

/** One row of the comparison: "Personal study plan" → "Initial plan" ("" = not included). */
export interface PackageFeature {
  label: string;
  value: string;
}

/** How a package bills: hours for one price, a rate per hour (no limit), or a fee per month with hours each month. */
export type PackageBilling = "package" | "hour" | "month";

/** Which courses offer it (054_package_billing). */
export type PackageAudience = "exam" | "university";

/** A package on /pricing, as Admin → Pricing saves it (053_packages). */
export interface PackageInput {
  name: string;
  tagline: string;
  /** Live hours: in total (package) or each month (month); null for hourly, and for Custom. */
  hours: number | null;
  /** Null = Custom (agreed with the student). */
  priceMinor: number | null;
  currency: Currency;
  billing: PackageBilling;
  audience: PackageAudience;
  features: PackageFeature[];
  /** Order on the page, low first. */
  position: number;
  /** Highlighted as the most popular. */
  featured: boolean;
  isActive: boolean;
}

export interface Package extends PackageInput {
  id: string;
}

/** A course on /pricing and the join form; PackageTable.groupOf decides its packages. */
export interface PricingCourse {
  title: string;
  slug: string;
  category: string;
  /** Exam sittings to pick from (exam courses only); empty = not an exam course. */
  sittings: string[];
}
