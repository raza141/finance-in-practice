import type { Currency } from "@/domains/invoices/types";

/** One row of the comparison: "Personal study plan" → "Initial plan" ("" = not included). */
export interface PackageFeature {
  label: string;
  value: string;
}

/** A package on /pricing, as Admin → Pricing saves it (053_packages). */
export interface PackageInput {
  name: string;
  tagline: string;
  /** Live hours included; null with priceMinor null = Custom (agreed with the student). */
  hours: number | null;
  priceMinor: number | null;
  currency: Currency;
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

/** A course on /pricing: exam courses take any package, other courses only Custom. */
export interface PricingCourse {
  title: string;
  slug: string;
  category: string;
  /** Exam sittings to pick from (exam courses only); empty = not an exam course. */
  sittings: string[];
}
