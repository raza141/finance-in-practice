import type { Invoice, InvoiceInput } from "../types";
import { InvoiceContract } from "./InvoiceContract";
import { InvoiceMath } from "./InvoiceMath";

/**
 * What an invoice changes from the accepted quote it came from: lines (by their
 * source line), prices, quantities, bases, currency, discount and terms. The
 * period is not compared: a quote may say "To be agreed" and the invoice must
 * state the real one. Pure.
 */
export class QuoteDiff {
  static changes(quote: Pick<Invoice, "items" | "currency" | "discountMinor" | "paymentTerms" | "termsDays">, invoice: Pick<InvoiceInput, "items" | "currency" | "discountMinor" | "paymentTerms" | "termsDays">): string[] {
    const money = (minor: number) => InvoiceMath.money(minor, invoice.currency);
    const out: string[] = [];
    if (quote.currency !== invoice.currency) out.push(`Currency ${quote.currency} → ${invoice.currency}`);
    quote.items.forEach((q, index) => {
      const line = invoice.items.find((item) => item.sourceLine === index);
      const name = `Line “${q.description}”`;
      if (!line) return out.push(`${name} removed`);
      if (line.description !== q.description) out.push(`${name} renamed “${line.description}”`);
      if (line.unit !== q.unit) out.push(`${name}: billed ${QuoteDiff.unit(q.unit)} → ${QuoteDiff.unit(line.unit)}`);
      if (line.quantity !== q.quantity) out.push(`${name}: quantity ${q.quantity} → ${line.quantity}`);
      if (line.unitMinor !== q.unitMinor) out.push(`${name}: price ${money(q.unitMinor)} → ${money(line.unitMinor)}`);
    });
    for (const line of invoice.items) {
      if (line.sourceLine === undefined || line.sourceLine >= quote.items.length) out.push(`Line “${line.description}” added (${money(line.amountMinor)})`);
    }
    if (quote.discountMinor !== invoice.discountMinor) out.push(`Discount ${money(quote.discountMinor)} → ${money(invoice.discountMinor)}`);
    const terms = (t: Pick<InvoiceInput, "paymentTerms" | "termsDays">) => InvoiceContract.termsLabel(t.paymentTerms, t.termsDays);
    if (terms(quote) !== terms(invoice)) out.push(`Terms ${terms(quote)} → ${terms(invoice)}`);
    return out;
  }

  private static unit(unit: string | undefined): string {
    return unit && Object.hasOwn(InvoiceContract.UNITS, unit) ? InvoiceContract.UNITS[unit as keyof typeof InvoiceContract.UNITS].toLowerCase() : (unit ?? "—");
  }
}
