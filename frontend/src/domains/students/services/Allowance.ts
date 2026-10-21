import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import type { Agreement } from "@/domains/invoices/types";

import type { HourRequest, MonthAllowance } from "../types";

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
 * carry over). Only 1-on-1 time counts: group classes and the free diagnostic
 * never use it up, and hand-logged sessions and the owner's corrections do.
 * The booking route refuses a session that would go over. Pure.
 */
export class Allowance {
  /** 1-on-1 time the student's own fee covers: not a group class, not the free diagnostic. */
  static billable(b: Pick<AllowanceBooking, "attendees" | "eventType">, freeSlug: string | undefined): boolean {
    return (b.attendees?.length ?? 0) <= 1 && !(freeSlug && b.eventType?.slug === freeSlug);
  }

  static monthOf(iso: string): string {
    return new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).dateOf(new Date(iso)).slice(0, 7);
  }

  /** The monthly agreement with an hours limit that covers `month`, if any. */
  static covering<T extends AllowanceAgreement>(agreements: readonly T[], month: string): T | null {
    return (
      agreements.find(
        (a) => a.unit === "month" && a.hoursPerMonth !== null && a.startsOn.slice(0, 7) <= month && (!a.endsOn || month <= a.endsOn.slice(0, 7)),
      ) ?? null
    );
  }

  /** `month`'s allowance, or null when no agreement with an hours limit covers it. */
  static forMonth({
    agreements,
    requests,
    bookings,
    manual,
    month,
    freeSlug,
    now = new Date(),
  }: {
    agreements: readonly AllowanceAgreement[];
    requests: readonly HourRequest[];
    bookings: readonly AllowanceBooking[];
    manual: readonly { date: string; minutes: number }[];
    month: string;
    freeSlug?: string;
    now?: Date;
  }): MonthAllowance | null {
    const agreement = Allowance.covering(agreements, month);
    if (!agreement) return null;
    let takenMinutes = manual.filter((m) => m.date.startsWith(month)).reduce((sum, m) => sum + Math.max(0, m.minutes), 0);
    let bookedMinutes = 0;
    for (const b of bookings) {
      if (Allowance.monthOf(b.start) !== month || !Allowance.billable(b, freeSlug)) continue;
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
      month,
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
