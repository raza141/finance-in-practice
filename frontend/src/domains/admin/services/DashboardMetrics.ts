import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import type { Currency, InvoiceDashboard } from "@/domains/invoices/types";

export interface ChartBar {
  /** "YYYY-MM". */
  month: string;
  /** "Oct". */
  label: string;
  totalMinor: number;
}

/** Pure shaping of the admin dashboard figures. */
export class DashboardMetrics {
  /** The `count` months ending with today's, oldest first, as "YYYY-MM". */
  static lastMonths(today: string, count = 6): string[] {
    const [year, month] = today.split("-").map(Number);
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));
      return d.toISOString().slice(0, 7);
    });
  }

  /**
   * Monthly paid income in one currency: the one with the most income over the
   * period (AED when there is none), since currencies can't be summed.
   */
  static incomeChart(paidByMonth: InvoiceDashboard["paidByMonth"], today: string): { currency: Currency; bars: ChartBar[] } {
    const totals = new Map<Currency, number>();
    for (const row of paidByMonth) totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.totalMinor);
    const currency = [...totals].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "AED";
    const bars = DashboardMetrics.lastMonths(today).map((month) => ({
      month,
      label: new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" }),
      totalMinor: paidByMonth.find((row) => row.month === month && row.currency === currency)?.totalMinor ?? 0,
    }));
    return { currency, bars };
  }

  /** Whole-percent change from last month; null when last month was zero. */
  static change(current: number, previous: number): number | null {
    return previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  }

  /** "AED 1,200.00 · USD 300.00"; the zero amount in AED when there is nothing. */
  static amounts(entries: readonly { currency: Currency; minor: number }[]): string {
    const nonZero = entries.filter((e) => e.minor !== 0);
    return nonZero.length === 0 ? InvoiceMath.money(0, "AED") : nonZero.map((e) => InvoiceMath.money(e.minor, e.currency)).join(" · ");
  }
}
