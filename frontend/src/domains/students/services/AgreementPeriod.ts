import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";

export interface Period {
  /** 0 = the agreement's first month. */
  index: number;
  /** YYYY-MM-DD, inclusive (Dubai dates). */
  start: string;
  end: string;
}

type Dated = { startsOn: string; endsOn: string | null };

/**
 * A monthly agreement's months run from its start date, not the calendar:
 * 17 Oct – 14 Nov is one month (17 Oct – 16 Nov, cut at the end date), billed
 * once and with one allowance. Month k starts on startsOn + k months (31 Jan
 * steps to 28 Feb, then 31 Mar) and ends the day before the next. Pure.
 */
export class AgreementPeriod {
  /** Safety stop for open-ended agreements. */
  static readonly MAX = 240;

  static nth(a: Dated, index: number): Period | null {
    if (index < 0) return null;
    const start = InvoiceMath.addMonths(a.startsOn, index);
    if (a.endsOn && start > a.endsOn) return null;
    const next = ZonedCalendar.addDays(InvoiceMath.addMonths(a.startsOn, index + 1), -1);
    return { index, start, end: a.endsOn && a.endsOn < next ? a.endsOn : next };
  }

  /** The agreement month that contains `date` (YYYY-MM-DD), or null outside the agreement. */
  static at(a: Dated, date: string): Period | null {
    if (date < a.startsOn || (a.endsOn && date > a.endsOn)) return null;
    const [y1, m1] = a.startsOn.split("-").map(Number);
    const [y2, m2] = date.split("-").map(Number);
    let index = y2 * 12 + m2 - (y1 * 12 + m1);
    if (InvoiceMath.addMonths(a.startsOn, index) > date) index -= 1;
    return AgreementPeriod.nth(a, index);
  }

  /** Every month of the agreement, up to MAX for open-ended ones. */
  static all(a: Dated): Period[] {
    const out: Period[] = [];
    for (let i = 0; i < AgreementPeriod.MAX; i++) {
      const p = AgreementPeriod.nth(a, i);
      if (!p) break;
      out.push(p);
    }
    return out;
  }

  /** How many months the agreement has; null when open-ended. */
  static count(a: Dated): number | null {
    return a.endsOn ? AgreementPeriod.all(a).length : null;
  }

  /** Days from `date` until `end` (0 on the end date or after). */
  static daysLeft(date: string, end: string): number {
    return Math.max(0, ZonedCalendar.daysBetween(date, end));
  }
}
