import type { Currency, InvoiceTotals } from "../types";

/** Integer money arithmetic and display for invoices. Pure: safe to import anywhere. */
export class InvoiceMath {
  /** Line amount in minor units: quantity (up to 2 decimals) x unit price, rounded half-up. */
  static lineAmount(quantity: number, unitMinor: number): number {
    return Math.round((Math.round(quantity * 100) * unitMinor) / 100);
  }

  /** Discount (a fixed amount) comes off the subtotal before tax; tax is rounded half-up. */
  static totals(lineAmounts: readonly number[], discountMinor: number, taxRateBp: number): InvoiceTotals {
    const subtotalMinor = lineAmounts.reduce((sum, amount) => sum + amount, 0);
    const taxMinor = Math.round(((subtotalMinor - discountMinor) * taxRateBp) / 10_000);
    return { subtotalMinor, discountMinor, taxMinor, totalMinor: subtotalMinor - discountMinor + taxMinor };
  }

  /** FIP-2026-0001: issue year and the global sequence, padded to at least 4 digits. */
  static number(issueDate: string, seq: number): string {
    return `FIP-${issueDate.slice(0, 4)}-${String(seq).padStart(4, "0")}`;
  }

  /** "AED 1,250.00". */
  static money(minor: number, currency: Currency): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "code" })
      .format(minor / 100)
      .replace(/ /g, " ");
  }

  /** Major units as typed ("4,500", "999.5") -> minor units; null when not a valid amount. */
  static parseMajor(raw: string): number | null {
    const cleaned = raw.replace(/[\s,]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
    const [whole, fraction = ""] = cleaned.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  }

  /** Minor units -> the text shown in an amount field. */
  static majorInput(minor: number): string {
    return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
  }

  /** 500 basis points -> "5"; 1250 -> "12.5". */
  static percent(bp: number): string {
    return String(bp / 100);
  }
}
