import type { Currency, ItemUnit } from "@/domains/invoices/types";

/** What a service is, as the admin form saves it (validated). How it is billed lives in its prices. */
export interface ServiceInput {
  /** Unique, upper case, e.g. "CF001". Lines copy it when added, so renaming never changes issued documents. */
  code: string;
  name: string;
  /** Default client-facing line detail. */
  description: string;
  category: string;
  /** Bases this service can be billed on, at least one. */
  units: ItemUnit[];
  /** Preselected on a new line; one of `units`, or null to make the user choose. */
  defaultUnit: ItemUnit | null;
}

/** A rate for one basis and currency over a date range (both ends inclusive; no end = open). */
export interface ServicePrice {
  id: string;
  unit: ItemUnit;
  currency: Currency;
  rateMinor: number;
  /** YYYY-MM-DD. */
  effectiveFrom: string;
  effectiveTo: string | null;
}

export type PriceInput = Omit<ServicePrice, "id">;

export interface Service extends ServiceInput {
  id: string;
  /** Archived services are hidden from new selections but stay on documents that used them. */
  archivedAt: Date | null;
  /** Oldest first. */
  prices: ServicePrice[];
}
