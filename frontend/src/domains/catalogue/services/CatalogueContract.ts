import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import type { Currency, ItemUnit } from "@/domains/invoices/types";

import type { PriceInput, Service, ServiceInput, ServicePrice } from "../types";

export type ServiceFieldErrors = Partial<Record<keyof ServiceInput, string>>;

type Parsed<T, E> = { ok: true; input: T } | { ok: false; errors: E };

/**
 * Validation for the service catalogue (same limits as the CHECKs in migration
 * 031) and price lookup. Pure: the admin forms and, later, the document
 * composer share it.
 */
export class CatalogueContract {
  static readonly LIMITS = { name: 120, description: 200, category: 60 } as const;
  private static readonly CODE = /^[A-Z0-9][A-Z0-9-]{1,19}$/;

  static parseService(fields: Record<string, unknown>): Parsed<ServiceInput, ServiceFieldErrors> {
    const { LIMITS } = CatalogueContract;
    const text = (name: string) => (typeof fields[name] === "string" ? (fields[name] as string).trim() : "");
    const errors: ServiceFieldErrors = {};

    const code = text("code").toUpperCase();
    if (!CatalogueContract.CODE.test(code)) errors.code = "2–20 letters, digits or dashes, e.g. CF001.";
    const name = text("name");
    if (!name || name.length > LIMITS.name) errors.name = `Enter the service name (up to ${LIMITS.name} characters).`;
    const description = text("description");
    if (description.length > LIMITS.description) errors.description = `Up to ${LIMITS.description} characters.`;
    const category = text("category");
    if (category.length > LIMITS.category) errors.category = `Up to ${LIMITS.category} characters.`;

    // Checkboxes: the action passes formData.getAll("units") as an array.
    const raw = Array.isArray(fields.units) ? fields.units : [];
    const units = CatalogueContract.UNIT_ORDER.filter((unit) => raw.includes(unit));
    if (units.length === 0 || raw.some((u) => !CatalogueContract.isUnit(u))) errors.units = "Tick at least one way this service is billed.";
    const unit = text("defaultUnit");
    const defaultUnit = unit === "" ? null : (unit as ItemUnit);
    if (defaultUnit !== null && !units.includes(defaultUnit)) errors.defaultUnit = "The default must be one of the ticked bases.";

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return { ok: true, input: { code, name, description, category, units, defaultUnit } };
  }

  /** A price from the add-price form, for a service billed on `units`; an error message otherwise. */
  static parsePrice(fields: Record<string, unknown>, units: readonly ItemUnit[]): PriceInput | string {
    const text = (name: string) => (typeof fields[name] === "string" ? (fields[name] as string).trim() : "");
    const unit = text("unit");
    if (!CatalogueContract.isUnit(unit) || !units.includes(unit)) return "Choose one of this service's billing bases.";
    const currency = text("currency") as Currency;
    if (!InvoiceContract.CURRENCIES.includes(currency)) return "Choose a currency.";
    // A missing price is not a zero price: a rate must be above 0.
    const rateMinor = InvoiceMath.parseMajor(text("rate"));
    if (!rateMinor || rateMinor > InvoiceContract.LIMITS.maxMinor) return "Enter a rate above 0, e.g. 450 or 450.50.";
    const effectiveFrom = text("effectiveFrom");
    if (!InvoiceContract.isIsoDate(effectiveFrom)) return "Choose the date the price starts.";
    const to = text("effectiveTo");
    if (to && (!InvoiceContract.isIsoDate(to) || to < effectiveFrom)) return "The end date must be on or after the start date, or empty.";
    return { unit, currency, rateMinor, effectiveFrom, effectiveTo: to || null };
  }

  /** The price for a basis and currency on `date` (YYYY-MM-DD), or null: never another basis's or currency's rate. */
  static priceOn(prices: readonly ServicePrice[], unit: ItemUnit, currency: Currency, date: string): ServicePrice | null {
    return (
      prices.find((p) => p.unit === unit && p.currency === currency && p.effectiveFrom <= date && (p.effectiveTo === null || p.effectiveTo >= date)) ??
      null
    );
  }

  /** Prices in force on `date`, one per basis and currency, in basis order. */
  static current(service: Pick<Service, "prices">, date: string): ServicePrice[] {
    const live = service.prices.filter((p) => p.effectiveFrom <= date && (p.effectiveTo === null || p.effectiveTo >= date));
    return live.sort((a, b) => CatalogueContract.UNIT_ORDER.indexOf(a.unit) - CatalogueContract.UNIT_ORDER.indexOf(b.unit) || a.currency.localeCompare(b.currency));
  }

  /** Search by code or name, case-insensitive. */
  static matches(service: Pick<Service, "code" | "name">, query: string): boolean {
    const q = query.trim().toLowerCase();
    return !q || service.code.toLowerCase().includes(q) || service.name.toLowerCase().includes(q);
  }

  /** "CF001 · CFA Level I tutoring". */
  static label(service: Pick<Service, "code" | "name">): string {
    return `${service.code} · ${service.name}`;
  }

  /** Bases in the order forms list them. */
  static readonly UNIT_ORDER = Object.keys(InvoiceContract.UNITS) as ItemUnit[];

  private static isUnit(value: unknown): value is ItemUnit {
    return typeof value === "string" && Object.hasOwn(InvoiceContract.UNITS, value);
  }
}
