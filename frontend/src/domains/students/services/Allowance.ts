import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import type { Agreement } from "@/domains/invoices/types";

import type { HourRequest, MonthAllowance } from "../types";
import { AgreementPeriod, type Period } from "./AgreementPeriod";

/** The parts of a Cal.com booking the allowance reads. */
export interface AllowanceBooking {
  start: string;
  end: string;
  status: string;
  attendees?: readonly unknown[];
  eventType?: { slug?: string } | null;
}

type AllowanceAgreement = Pick<Agreement, "id" | "serviceName" | "unit" | "startsOn" | "endsOn" | "hoursPerMonth">;

/**
 * Hours included in a monthly agreement (e.g. 30 h a month; unused hours don't
 * carry over). A month is the agreement's own (AgreementPeriod: 17 Oct – 16 Nov),
 * and a request for more hours is keyed by its month's start (YYYY-MM). Only 1-on-1 time counts: group classes and the free diagnostic
 * never use it up, and hand-logged sessions and the owner's corrections do.
 * The booking route refuses a session that would go over. Pure.
 */
export class Allowance {
  /** 1-on-1 time the student's own fee covers: not a group class, not the free diagnostic. */
  static billable(b: Pick<AllowanceBooking, "attendees" | "eventType">, freeSlug: string | undefined): boolean {
    return (b.attendees?.length ?? 0) <= 1 && !(freeSlug && b.eventType?.slug === freeSlug);
  }

  /** The Dubai date (YYYY-MM-DD) of an instant. */
  static dateOf(iso: string): string {
    return new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).dateOf(new Date(iso));
  }

  static monthOf(iso: string): string {
    return Allowance.dateOf(iso).slice(0, 7);
  }

  /**
   * The agreement with an hours limit running on `date`, with its month that contains it.
   * A package's hours (hoursPerMonth holds its total) last for the whole agreement: one period, start to end.
   */
  static covering<T extends AllowanceAgreement>(agreements: readonly T[], date: string): { agreement: T; period: Period } | null {
    for (const agreement of agreements) {
      if (agreement.hoursPerMonth === null) continue;
      const period =
        agreement.unit === "month"
          ? AgreementPeriod.at(agreement, date)
          : agreement.unit === "package" && date >= agreement.startsOn && (!agreement.endsOn || date <= agreement.endsOn)
            ? { index: 0, start: agreement.startsOn, end: agreement.endsOn ?? Allowance.OPEN_END }
            : null;
      if (period) return { agreement, period };
    }
    return null;
  }

  /** A package with no end date: its period's end. */
  static readonly OPEN_END = "9999-12-31";

  /** The allowance of the agreement month containing `date`, or null when no agreement with an hours limit covers it. */
  static forDate({
    agreements,
    requests,
    bookings,
    manual,
    date,
    freeSlug,
    now = new Date(),
  }: {
    agreements: readonly AllowanceAgreement[];
    requests: readonly HourRequest[];
    bookings: readonly AllowanceBooking[];
    manual: readonly { date: string; minutes: number }[];
    date: string;
    freeSlug?: string;
    now?: Date;
  }): MonthAllowance | null {
    const found = Allowance.covering(agreements, date);
    if (!found) return null;
    const { agreement, period } = found;
    const month = period.start.slice(0, 7);
    const within = (day: string) => day >= period.start && day <= period.end;
    let takenMinutes = manual.filter((m) => within(m.date)).reduce((sum, m) => sum + Math.max(0, m.minutes), 0);
    let bookedMinutes = 0;
    for (const b of bookings) {
      if (!within(Allowance.dateOf(b.start)) || !Allowance.billable(b, freeSlug)) continue;
      const minutes = Math.max(0, Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60_000));
      const ended = Date.parse(b.end) <= now.getTime();
      if (b.status === "accepted" && ended) takenMinutes += minutes;
      else if ((b.status === "accepted" || b.status === "pending") && !ended) bookedMinutes += minutes;
    }
    const own = requests.filter((r) => r.agreementId === agreement.id && r.month === month);
    const minutes = (list: HourRequest[]) => Math.round(list.reduce((sum, r) => sum + r.hours, 0) * 60);
    const extraMinutes = minutes(own.filter((r) => r.status === "free" || r.status === "billed"));
    const includedMinutes = Math.round((agreement.hoursPerMonth ?? 0) * 60);
    return {
      agreementId: agreement.id,
      serviceName: agreement.serviceName,
      package: agreement.unit === "package",
      month,
      periodStart: period.start,
      periodEnd: period.end,
      includedMinutes,
      extraMinutes,
      extraBilledMinutes: minutes(own.filter((r) => r.status === "billed")),
      takenMinutes,
      bookedMinutes,
      leftMinutes: includedMinutes + extraMinutes - takenMinutes - bookedMinutes,
      pending: own.find((r) => r.status === "pending") ?? null,
    };
  }
}
