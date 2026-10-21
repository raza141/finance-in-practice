import type { Agreement, Currency } from "@/domains/invoices/types";

import { Allowance } from "./Allowance";

interface CapacityBooking {
  uid: string;
  start: string;
  end: string;
  status: string;
  attendees?: readonly { email: string }[];
  eventType?: { slug?: string } | null;
}

type Money = { currency: Currency; minor: number };

export interface CapacityRow {
  clientId: string;
  name: string;
  /** 1-on-1 time taught this month (corrections and hand-logged sessions included). */
  minutesTaught: number;
  sessions: number;
  /** Still to come this month. */
  minutesBooked: number;
  /** Hours included by their monthly agreement; null = no limit. */
  includedMinutes: number | null;
  agreed: Money[];
  invoiced: Money[];
  paid: Money[];
  /** Invoiced (or, before any invoice, the agreed fee) per hour taught; null with no hours or no fee. */
  perHour: (Money & { basis: "invoiced" | "agreed" }) | null;
}

/**
 * The owner's month across clients: where the 1-on-1 hours go and what each
 * client pays for them, to see who takes the most time for the least fee.
 * Group classes and the free diagnostic are left out. Pure.
 */
export class Capacity {
  static rows({
    clients,
    bookings,
    log,
    money,
    agreements,
    month,
    freeSlug,
    now = new Date(),
  }: {
    clients: readonly { id: string; name: string; email: string }[];
    bookings: readonly CapacityBooking[];
    log: readonly { clientId: string; bookingUid: string | null; onDate: string | null; minutes: number }[];
    money: readonly { clientId: string; currency: Currency; invoicedMinor: number; paidMinor: number }[];
    agreements: readonly Pick<Agreement, "clientId" | "id" | "serviceName" | "unit" | "rateMinor" | "currency" | "startsOn" | "endsOn" | "hoursPerMonth">[];
    month: string;
    freeSlug?: string;
    now?: Date;
  }): CapacityRow[] {
    const byEmail = new Map(clients.map((c) => [c.email.trim().toLowerCase(), c.id]));
    const corrected = new Map(log.flatMap((l) => (l.bookingUid ? [[l.bookingUid, l.minutes] as const] : [])));
    const rows = new Map<string, CapacityRow>();
    const row = (clientId: string) => {
      let r = rows.get(clientId);
      if (!r) {
        const client = clients.find((c) => c.id === clientId);
        r = { clientId, name: client?.name ?? "Unknown", minutesTaught: 0, sessions: 0, minutesBooked: 0, includedMinutes: null, agreed: [], invoiced: [], paid: [], perHour: null };
        rows.set(clientId, r);
      }
      return r;
    };

    for (const b of bookings) {
      if (Allowance.monthOf(b.start) !== month || !Allowance.billable(b, freeSlug)) continue;
      const clientId = byEmail.get(b.attendees?.[0]?.email.trim().toLowerCase() ?? "");
      if (!clientId) continue;
      const ended = Date.parse(b.end) <= now.getTime();
      const minutes = ended && corrected.has(b.uid) ? corrected.get(b.uid)! : Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60_000);
      if (b.status === "accepted" && ended && minutes > 0) {
        row(clientId).minutesTaught += minutes;
        row(clientId).sessions += 1;
      } else if ((b.status === "accepted" || b.status === "pending") && !ended) {
        row(clientId).minutesBooked += minutes;
      }
    }
    for (const l of log) {
      if (!l.onDate?.startsWith(month) || l.minutes <= 0 || !clients.some((c) => c.id === l.clientId)) continue;
      row(l.clientId).minutesTaught += l.minutes;
      row(l.clientId).sessions += 1;
    }
    for (const m of money) {
      if (!clients.some((c) => c.id === m.clientId)) continue;
      if (m.invoicedMinor > 0) row(m.clientId).invoiced.push({ currency: m.currency, minor: m.invoicedMinor });
      if (m.paidMinor > 0) row(m.clientId).paid.push({ currency: m.currency, minor: m.paidMinor });
    }
    for (const a of agreements) {
      if (a.unit !== "month" || !clients.some((c) => c.id === a.clientId)) continue;
      if (a.startsOn.slice(0, 7) > month || (a.endsOn && a.endsOn.slice(0, 7) < month)) continue;
      const r = row(a.clientId);
      r.agreed.push({ currency: a.currency, minor: a.rateMinor });
      if (a.hoursPerMonth !== null) r.includedMinutes = (r.includedMinutes ?? 0) + Math.round(a.hoursPerMonth * 60);
    }

    for (const r of rows.values()) {
      const [fee, basis] = r.invoiced.length > 0 ? [r.invoiced[0], "invoiced" as const] : r.agreed.length > 0 ? [r.agreed[0], "agreed" as const] : [null, null];
      if (fee && basis && r.minutesTaught > 0) r.perHour = { currency: fee.currency, minor: Math.round(fee.minor / (r.minutesTaught / 60)), basis };
    }
    return [...rows.values()]
      .filter((r) => r.minutesTaught + r.minutesBooked > 0 || r.invoiced.length + r.paid.length + r.agreed.length > 0)
      .sort((a, b) => b.minutesTaught - a.minutesTaught || a.name.localeCompare(b.name));
  }
}
