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

  /** YYYY-MM-DD plus `months`, clamped to the month's last day (31 Jan + 1 -> 28/29 Feb). */
  static addMonths(isoDate: string, months: number): string {
    const [year, month, day] = isoDate.split("-").map(Number);
    const first = new Date(Date.UTC(year, month - 1 + months, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(day, lastDay));
    return first.toISOString().slice(0, 10);
  }

  /**
   * Moves capitalised month names in text one month on, keeping the style
   * ("October" -> "November", "Dec 2026" -> "Jan 2027"). For copying a
   * monthly invoice; the owner reviews the draft before issuing it.
   */
  static nextMonthText(text: string): string {
    return text.replace(InvoiceMath.MONTH_PATTERN, (_match, name: string, gap: string | undefined, year: string | undefined) => {
      const index = InvoiceMath.MONTHS.findIndex((m) => name === m || name === m.slice(0, 3) || (name === "Sept" && m === "September"));
      const next = InvoiceMath.MONTHS[(index + 1) % 12];
      const rolled = name.length === InvoiceMath.MONTHS[index].length ? next : next.slice(0, 3);
      return year ? `${rolled}${gap}${index === 11 ? Number(year) + 1 : year}` : rolled;
    });
  }

  private static readonly MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  private static readonly MONTH_PATTERN =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b(?:(\s+)(\d{4})\b)?/g;

  /** 500 basis points -> "5"; 1250 -> "12.5". */
  static percent(bp: number): string {
    return String(bp / 100);
  }
}
