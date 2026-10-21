import type { AgreementInput, Invoice, ItemUnit } from "../types";
import { InvoiceContract } from "./InvoiceContract";

export type QuoteAgreementResult = { ok: true; input: AgreementInput } | { ok: false; reason: string };

const AGREED_TERMS = new Set(["on_receipt", "net7", "net14", "net30", "custom"]);

/**
 * The client agreement an accepted quote creates: the monthly catalogue line
 * (else the first catalogue line) gives the service, basis and rate; the quote's
 * agreement block gives the dates and hours a month. Pure.
 */
export class QuoteAgreements {
  static toAgreement(quote: Pick<Invoice, "items" | "currency" | "agreement" | "paymentTerms" | "termsDays">): QuoteAgreementResult {
    if (!quote.agreement) return { ok: false, reason: "The quote has no agreement block." };
    const priced = quote.items.filter((i) => i.serviceId && i.unit && Object.hasOwn(InvoiceContract.UNITS, i.unit));
    const line = priced.find((i) => i.unit === "month") ?? priced[0];
    if (!line?.serviceId) return { ok: false, reason: "No line is a catalogue service, so no agreement could be created. Add it by hand in Clients." };
    const unit = line.unit as ItemUnit;
    return {
      ok: true,
      input: {
        serviceId: line.serviceId,
        unit,
        currency: quote.currency,
        rateMinor: line.unitMinor,
        startsOn: quote.agreement.startsOn,
        endsOn: quote.agreement.endsOn,
        paymentTerms: AGREED_TERMS.has(quote.paymentTerms) ? (quote.paymentTerms as AgreementInput["paymentTerms"]) : null,
        termsDays: quote.paymentTerms === "custom" ? quote.termsDays : null,
        schedule: "",
        scope: (line.detail ?? "").slice(0, 500),
        hoursPerMonth: unit === "month" ? quote.agreement.hoursPerMonth : null,
      },
    };
  }
}
