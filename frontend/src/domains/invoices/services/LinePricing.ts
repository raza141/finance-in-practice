import { CatalogueContract } from "@/domains/catalogue/services/CatalogueContract";
import type { Service } from "@/domains/catalogue/types";

import type { Agreement, Currency, InvoiceItem, ItemUnit } from "../types";

/** What a line is priced against when added or checked. */
export interface PricingContext {
  clientId: string | null;
  currency: Currency;
  /** YYYY-MM-DD: used when a line has no dated period. */
  today: string;
}

/** A price suggestion for a line, with where it came from. */
export interface PriceSuggestion {
  rateMinor: number;
  source: "agreement" | "catalogue";
  agreementId?: string;
}

/**
 * Prices lines from agreements and the catalogue, and re-checks what the form
 * claims on save. Priority: an agreement the user picked, then the catalogue
 * price for the line's basis, currency and date, else the user types it. Never
 * borrows another basis's or currency's rate; never invents a zero. Pure.
 */
export class LinePricing {
  /** The first day a period covers ("2026-10" -> "2026-10-01", a range -> its start), or null for text. */
  static periodStart(period: string | undefined): string | null {
    if (!period) return null;
    if (/^\d{4}-\d{2}$/.test(period)) return `${period}-01`;
    const match = /^(\d{4}-\d{2}-\d{2})(\/\d{4}-\d{2}-\d{2})?$/.exec(period);
    return match ? match[1] : null;
  }

  /** Agreements of this client for this service in force on `date`, any basis (the user chooses; never picked silently). */
  static agreementsFor(agreements: readonly Agreement[], clientId: string | null, serviceId: string, date: string): Agreement[] {
    return agreements.filter(
      (a) => a.clientId === clientId && a.serviceId === serviceId && !a.archivedAt && a.startsOn <= date && (a.endsOn === null || a.endsOn >= date),
    );
  }

  /** The catalogue price for a service line, or null (a missing price stays missing). */
  static cataloguePrice(service: Pick<Service, "prices">, unit: ItemUnit, currency: Currency, date: string): PriceSuggestion | null {
    const price = CatalogueContract.priceOn(service.prices, unit, currency, date);
    return price ? { rateMinor: price.rateMinor, source: "catalogue" } : null;
  }

  /**
   * Lines as saved: the service code copied from the catalogue, and the price
   * source kept only when it is true (the agreement or catalogue rate really
   * is the line's rate on its date); otherwise "manual". An unknown service or
   * a basis the service doesn't offer is an error message.
   */
  static verify(items: readonly InvoiceItem[], services: readonly Service[], agreements: readonly Agreement[], context: PricingContext): InvoiceItem[] | string {
    const out: InvoiceItem[] = [];
    for (const [index, item] of items.entries()) {
      const row = `Line ${index + 1}: `;
      // Only what the server vouches for is kept from the form's claims.
      const { description, detail, period, unit: rawUnit, quantity, unitMinor, amountMinor, sourceLine } = item;
      const line: InvoiceItem = {
        description,
        ...(detail && { detail }),
        ...(period && { period }),
        unit: rawUnit,
        quantity,
        unitMinor,
        amountMinor,
        ...(sourceLine !== undefined && { sourceLine }),
      };
      if (!item.serviceId) {
        out.push({ ...line, pricingSource: "manual" });
        continue;
      }
      const service = services.find((s) => s.id === item.serviceId);
      if (!service) return `${row}that service no longer exists. Pick another or make it a custom line.`;
      const unit = item.unit as ItemUnit;
      if (!service.units.includes(unit)) return `${row}${service.code} is not billed that way. Choose one of its bases.`;
      const date = LinePricing.periodStart(item.period) ?? context.today;
      let source: InvoiceItem["pricingSource"] = "manual";
      let agreementId: string | undefined;
      if (item.pricingSource === "agreement") {
        const agreement = agreements.find((a) => a.id === item.agreementId);
        const valid =
          agreement &&
          LinePricing.agreementsFor([agreement], context.clientId, service.id, date).length === 1 &&
          agreement.unit === unit &&
          agreement.currency === context.currency &&
          agreement.rateMinor === item.unitMinor;
        if (valid) [source, agreementId] = ["agreement", agreement.id];
      } else if (item.pricingSource === "catalogue") {
        if (LinePricing.cataloguePrice(service, unit, context.currency, date)?.rateMinor === item.unitMinor) source = "catalogue";
      }
      out.push({ ...line, serviceId: service.id, code: service.code, pricingSource: source, ...(agreementId && { agreementId }) });
    }
    return out;
  }
}
