import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { Ledger } from "@/domains/invoices/services/Ledger";
import type { Agreement, ClientDocument, Currency, LedgerEntry } from "@/domains/invoices/types";

import type { AccountAgreement, AccountMoney, AccountMonth, PrepaidBlock, StudentAccountView, StudentPlan } from "../types";

type AgreementLike = Pick<Agreement, "serviceName" | "unit" | "rateMinor" | "currency" | "startsOn" | "endsOn" | "scope">;

/** The parts of a Cal.com booking the account reads. */
interface BookingLike {
  start: string;
  end: string;
  status: string;
  attendees?: readonly unknown[];
  eventType?: { slug?: string } | null;
}

interface AccountSources {
  entries: readonly LedgerEntry[];
  /** Null: couldn't be read. */
  documents: readonly ClientDocument[] | null;
  bookings: readonly BookingLike[] | null;
  /** The client's payment plan in admin Clients; a live agreement wins over it. */
  plan: StudentPlan | null;
  /** Live (not archived) agreements. */
  agreements?: readonly AgreementLike[];
  /** Sessions the owner logged by hand (never booked in Cal.com): 1-on-1 time, billable. */
  manual?: readonly { date: string; minutes: number }[];
  /** The free diagnostic's event slug: studied, but never taken from paid hours. */
  freeSlug?: string;
  now?: Date;
}

/**
 * A student's account in their portal: hours studied and booked per month
 * (from Cal.com), money billed, paid and owed (from the billing ledger), and
 * what is left of hours or sessions billed up front. Months are Dubai months,
 * like every billing document. Pure.
 */
export class StudentAccount {
  /** Months shown up to the current one; next month is added after them. */
  static readonly MONTHS = 6;
  static readonly PACE_MONTHS = 3;

  static build({ entries, documents, bookings, plan, agreements = [], manual = [], freeSlug, now = new Date() }: AccountSources): StudentAccountView {
    const calendar = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE);
    const monthOf = (iso: string) => calendar.dateOf(new Date(iso)).slice(0, 7);
    const current = calendar.dateOf(now).slice(0, 7);
    const nextMonth = InvoiceMath.addMonths(`${current}-01`, 1).slice(0, 7);
    const shown = [...Array.from({ length: StudentAccount.MONTHS }, (_, i) => InvoiceMath.addMonths(`${current}-01`, i - StudentAccount.MONTHS + 1).slice(0, 7)), nextMonth];

    const months = new Map<string, AccountMonth>(
      shown.map((month) => [month, { month, minutesTaken: 0, sessionsTaken: 0, minutesBooked: 0, sessionsBooked: 0, billed: [], paid: [], agreed: [] }]),
    );
    // Every month with a session, not only those shown: the pace needs the full history.
    const takenByMonth = new Map<string, number>();
    let taken: StudentAccountView["taken"] = null;
    // What their own invoices pay for: 1-on-1 sessions, not group classes or the free diagnostic.
    const billable = { minutes: 0, sessions: 0 };
    // ponytail: Cal.com returns the latest 100 bookings, so all-time totals undercount past ~100 sessions; page through bookingsFor if a student gets there.
    if (bookings) {
      taken = { minutes: 0, sessions: 0 };
      for (const session of manual) {
        if (session.minutes <= 0) continue;
        const month = session.date.slice(0, 7);
        taken.minutes += session.minutes;
        taken.sessions += 1;
        billable.minutes += session.minutes;
        billable.sessions += 1;
        takenByMonth.set(month, (takenByMonth.get(month) ?? 0) + session.minutes);
        const row = months.get(month);
        if (row) {
          row.minutesTaken += session.minutes;
          row.sessionsTaken += 1;
        }
      }
      for (const b of bookings) {
        const minutes = Math.max(0, Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60_000));
        const month = monthOf(b.start);
        const row = months.get(month);
        const ended = Date.parse(b.end) <= now.getTime();
        if (b.status === "accepted" && ended) {
          taken.minutes += minutes;
          taken.sessions += 1;
          if ((b.attendees?.length ?? 0) <= 1 && !(freeSlug && b.eventType?.slug === freeSlug)) {
            billable.minutes += minutes;
            billable.sessions += 1;
          }
          takenByMonth.set(month, (takenByMonth.get(month) ?? 0) + minutes);
          if (row) {
            row.minutesTaken += minutes;
            row.sessionsTaken += 1;
          }
        } else if ((b.status === "accepted" || b.status === "pending") && !ended && row) {
          row.minutesBooked += minutes;
          row.sessionsBooked += 1;
        }
      }
    }

    for (const entry of entries) {
      const row = months.get(entry.date.slice(0, 7));
      if (!row) continue;
      if (entry.debitMinor > 0) StudentAccount.add(row.billed, entry.currency, entry.debitMinor);
      if (entry.kind === "payment") StudentAccount.add(row.paid, entry.currency, entry.creditMinor);
    }

    const live = agreements.filter((a) => !a.endsOn || a.endsOn.slice(0, 7) >= current);
    for (const a of live.filter((x) => x.unit === "month")) {
      for (const row of months.values()) {
        if (a.startsOn.slice(0, 7) <= row.month && (!a.endsOn || row.month <= a.endsOn.slice(0, 7))) StudentAccount.add(row.agreed, a.currency, a.rateMinor);
      }
    }
    // The fee basis for next month: a monthly agreement covering it, any other live agreement, then the client's plan.
    const covers = (a: AgreementLike) => a.startsOn.slice(0, 7) <= nextMonth && (!a.endsOn || nextMonth <= a.endsOn.slice(0, 7));
    const basis = live.find((a) => a.unit === "month" && covers(a)) ?? live.find((a) => a.unit !== "month" && covers(a));
    if (basis) plan = { unit: basis.unit, feeMinor: basis.rateMinor, currency: basis.currency };

    const next = months.get(nextMonth)!;
    const paceMinutes = StudentAccount.pace(takenByMonth, current);
    return {
      months: [...months.values()],
      taken,
      money: StudentAccount.money(entries),
      prepaid: taken ? StudentAccount.prepaid(documents ?? [], billable) : [],
      plan,
      agreements: live.map((a) => StudentAccount.agreement(a, current)),
      next: {
        month: nextMonth,
        minutesBooked: next.minutesBooked,
        sessionsBooked: next.sessionsBooked,
        paceMinutes,
        estimateMinor: StudentAccount.estimate(plan, paceMinutes ?? (next.minutesBooked || null), next.sessionsBooked, taken),
      },
      documents: documents ? [...documents] : null,
    };
  }

  /** Monthly with an end: months after `current` up to the end month, and what they add up to. */
  static agreement(a: AgreementLike, current: string): AccountAgreement {
    if (a.unit !== "month" || !a.endsOn) return { ...a, monthsLeft: null, remainingMinor: null };
    const [y1, m1] = current.split("-").map(Number);
    const [y2, m2] = a.endsOn.slice(0, 7).split("-").map(Number);
    const [ys, ms] = a.startsOn.slice(0, 7).split("-").map(Number);
    // Not started yet: count from its first month.
    const from = Math.max(y1 * 12 + m1 + 1, ys * 12 + ms);
    const monthsLeft = Math.max(0, y2 * 12 + m2 - from + 1);
    return { ...a, monthsLeft, remainingMinor: monthsLeft * a.rateMinor };
  }

  /** Charged, paid, credited and owed per currency, from the same ledger as the client's statement. */
  static money(entries: readonly LedgerEntry[]): AccountMoney[] {
    const rows = Ledger.running(entries);
    const out = new Map<Currency, AccountMoney>();
    for (const row of rows) {
      const money = out.get(row.currency) ?? { currency: row.currency, chargedMinor: 0, paidMinor: 0, creditedMinor: 0, balanceMinor: 0 };
      money.chargedMinor += row.debitMinor;
      if (row.kind === "payment") money.paidMinor += row.creditMinor;
      if (row.kind === "credit_note") money.creditedMinor += row.creditMinor;
      money.balanceMinor = row.balanceMinor;
      out.set(row.currency, money);
    }
    return [...out.values()];
  }

  /** Average minutes a month over the last full months since their first session (up to PACE_MONTHS); null before a full month. */
  static pace(takenByMonth: ReadonlyMap<string, number>, current: string): number | null {
    const first = [...takenByMonth.keys()].sort()[0];
    if (!first || first >= current) return null;
    const full: string[] = [];
    for (let i = 1; i <= StudentAccount.PACE_MONTHS; i++) {
      const month = InvoiceMath.addMonths(`${current}-01`, -i).slice(0, 7);
      if (month < first) break;
      full.push(month);
    }
    return Math.round(full.reduce((sum, month) => sum + (takenByMonth.get(month) ?? 0), 0) / full.length);
  }

  /** Hours or sessions their invoices billed (credit notes give back) against the billable ones taken. Only units that were billed show. */
  private static prepaid(documents: readonly ClientDocument[], taken: { minutes: number; sessions: number }): PrepaidBlock[] {
    const hours = documents.reduce((sum, d) => sum + d.hours, 0);
    const sessions = documents.reduce((sum, d) => sum + d.sessions, 0);
    return [
      ...(hours > 0 ? [{ unit: "hour" as const, billed: hours, used: Math.round((taken.minutes / 60) * 100) / 100 }] : []),
      ...(sessions > 0 ? [{ unit: "session" as const, billed: sessions, used: taken.sessions }] : []),
    ];
  }

  /** Next month's fee: the monthly fee, or the hourly / per-session fee at their pace. */
  private static estimate(plan: StudentPlan | null, minutes: number | null, sessionsBooked: number, taken: StudentAccountView["taken"]): number | null {
    if (!plan || plan.feeMinor <= 0) return null;
    if (plan.unit === "month") return plan.feeMinor;
    if (!minutes) return null;
    if (plan.unit === "hour") return Math.round((minutes / 60) * plan.feeMinor);
    if (plan.unit === "session") {
      // Sessions at their usual length; the booked count when there's no history.
      const average = taken && taken.sessions > 0 ? taken.minutes / taken.sessions : null;
      const sessions = average ? Math.round(minutes / average) : sessionsBooked;
      return sessions > 0 ? sessions * plan.feeMinor : null;
    }
    return null;
  }

  private static add(list: { currency: Currency; minor: number }[], currency: Currency, minor: number): void {
    const found = list.find((x) => x.currency === currency);
    if (found) found.minor += minor;
    else list.push({ currency, minor });
  }
}
