import type { Currency, LedgerEntry } from "../types";

export interface LedgerRow extends LedgerEntry {
  /** What the client owes after this line (negative = in credit). */
  balanceMinor: number;
}

export interface StatementSection {
  currency: Currency;
  openingMinor: number;
  rows: LedgerRow[];
  closingMinor: number;
}

/** Running balances over a client's ledger, kept per currency (never added across). Pure. */
export class Ledger {
  /** Oldest first, each line with the balance after it. */
  static running(entries: readonly LedgerEntry[]): LedgerRow[] {
    const totals = new Map<Currency, number>();
    return entries.map((entry) => {
      const balanceMinor = (totals.get(entry.currency) ?? 0) + entry.debitMinor - entry.creditMinor;
      totals.set(entry.currency, balanceMinor);
      return { ...entry, balanceMinor };
    });
  }

  /** One calendar month ("YYYY-MM") per currency: opening balance, the month's lines, closing balance. */
  static statement(entries: readonly LedgerEntry[], month: string): StatementSection[] {
    const rows = Ledger.running(entries);
    const currencies = [...new Set(rows.map((row) => row.currency))];
    return currencies
      .map((currency) => {
        const own = rows.filter((row) => row.currency === currency);
        const before = own.filter((row) => row.date < `${month}-01`);
        const inMonth = own.filter((row) => row.date.startsWith(month));
        const openingMinor = before.at(-1)?.balanceMinor ?? 0;
        return { currency, openingMinor, rows: inMonth, closingMinor: inMonth.at(-1)?.balanceMinor ?? openingMinor };
      })
      .filter((section) => section.rows.length > 0 || section.openingMinor !== 0);
  }
}
