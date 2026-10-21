import { describe, expect, it } from "vitest";

import type { ClientDocument, LedgerEntry } from "@/domains/invoices/types";

import { StudentAccount } from "./StudentAccount";

const NOW = new Date("2026-10-21T08:00:00Z");
const booking = (start: string, hours: number, status = "accepted", patch: object = {}) => ({
  start,
  end: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
  status,
  ...patch,
});
const entry = (date: string, kind: LedgerEntry["kind"], currency: LedgerEntry["currency"], debitMinor: number, creditMinor: number): LedgerEntry => ({
  date,
  kind,
  documentId: "d",
  number: null,
  currency,
  debitMinor,
  creditMinor,
});
const doc = (patch: Partial<ClientDocument>): ClientDocument => ({
  id: "x",
  docType: "invoice",
  number: "FIP-INV-1",
  status: "sent",
  currency: "AED",
  totalMinor: 0,
  balanceMinor: 0,
  issueDate: "2026-10-01",
  token: null,
  hours: 0,
  sessions: 0,
  ...patch,
});

describe("StudentAccount", () => {
  it("counts ended accepted sessions in their Dubai month, upcoming as booked, and skips cancelled ones", () => {
    const view = StudentAccount.build({
      entries: [],
      documents: [],
      plan: null,
      now: NOW,
      bookings: [
        // 31 Aug 21:00 UTC is 1 Sep 01:00 in Dubai.
        booking("2026-08-31T21:00:00Z", 1),
        booking("2026-10-20T10:00:00Z", 1.5),
        booking("2026-10-19T10:00:00Z", 1, "cancelled"),
        booking("2026-10-28T10:00:00Z", 1, "pending"),
        booking("2026-11-03T10:00:00Z", 2),
      ],
    });
    const month = (m: string) => view.months.find((x) => x.month === m)!;
    expect(view.months.map((m) => m.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(month("2026-08").minutesTaken).toBe(0);
    expect(month("2026-09").minutesTaken).toBe(60);
    expect(month("2026-10")).toMatchObject({ minutesTaken: 90, sessionsTaken: 1, minutesBooked: 60, sessionsBooked: 1 });
    expect(view.next).toMatchObject({ month: "2026-11", minutesBooked: 120, sessionsBooked: 1 });
    expect(view.taken).toEqual({ minutes: 150, sessions: 2 });
  });

  it("reports unknown hours (not zero) when Cal.com couldn't be read", () => {
    const view = StudentAccount.build({ entries: [], documents: [doc({ hours: 10 })], bookings: null, plan: null, now: NOW });
    expect(view.taken).toBeNull();
    expect(view.prepaid).toEqual([]);
  });

  it("keeps currencies apart and never counts a credit note as paid", () => {
    const money = StudentAccount.money([
      entry("2026-09-01", "invoice", "AED", 200_000, 0),
      entry("2026-09-05", "payment", "AED", 0, 150_000),
      entry("2026-09-10", "credit_note", "AED", 0, 20_000),
      entry("2026-10-01", "invoice", "USD", 50_000, 0),
    ]);
    expect(money).toEqual([
      { currency: "AED", chargedMinor: 200_000, paidMinor: 150_000, creditedMinor: 20_000, balanceMinor: 30_000 },
      { currency: "USD", chargedMinor: 50_000, paidMinor: 0, creditedMinor: 0, balanceMinor: 50_000 },
    ]);
  });

  it("puts billed and paid amounts in their month", () => {
    const view = StudentAccount.build({
      entries: [entry("2026-10-02", "invoice", "AED", 100_000, 0), entry("2026-10-03", "payment", "AED", 0, 40_000)],
      documents: [],
      bookings: [],
      plan: null,
      now: NOW,
    });
    expect(view.months.at(-2)).toMatchObject({ billed: [{ currency: "AED", minor: 100_000 }], paid: [{ currency: "AED", minor: 40_000 }] });
  });

  it("shows what is left of billed hours, net of credit notes", () => {
    const view = StudentAccount.build({
      entries: [],
      documents: [doc({ hours: 10 }), doc({ docType: "credit_note", hours: -2 })],
      bookings: [booking("2026-10-01T10:00:00Z", 1.5), booking("2026-10-08T10:00:00Z", 1.5)],
      plan: null,
      now: NOW,
    });
    expect(view.prepaid).toEqual([{ unit: "hour", billed: 8, used: 3 }]);
  });

  it("never takes the free diagnostic or a group class from paid hours, but counts them as studied", () => {
    const view = StudentAccount.build({
      entries: [],
      documents: [doc({ hours: 10 })],
      bookings: [
        booking("2026-09-01T10:00:00Z", 0.5, "accepted", { eventType: { slug: "30min" } }),
        booking("2026-09-08T10:00:00Z", 2, "accepted", { attendees: [{}, {}, {}] }),
        booking("2026-09-15T10:00:00Z", 1, "accepted", { attendees: [{}], eventType: { slug: "session" } }),
      ],
      plan: null,
      freeSlug: "30min",
      now: NOW,
    });
    expect(view.taken).toEqual({ minutes: 210, sessions: 3 });
    expect(view.prepaid).toEqual([{ unit: "hour", billed: 10, used: 1 }]);
  });

  it("estimates next month from the plan at their usual pace", () => {
    // Started in Aug (2 h), then Sep (4 h): the pace averages those full months, 3 h; October is not over.
    const bookings = [booking("2026-08-10T10:00:00Z", 2), booking("2026-09-10T10:00:00Z", 4), booking("2026-10-10T10:00:00Z", 1)];
    const hourly = StudentAccount.build({ entries: [], documents: [], bookings, plan: { unit: "hour", feeMinor: 30_000, currency: "AED" }, now: NOW });
    expect(hourly.next.paceMinutes).toBe(180);
    expect(hourly.next.estimateMinor).toBe(90_000);
    const monthly = StudentAccount.build({ entries: [], documents: [], bookings, plan: { unit: "month", feeMinor: 200_000, currency: "AED" }, now: NOW });
    expect(monthly.next.estimateMinor).toBe(200_000);
    const fresh = StudentAccount.build({ entries: [], documents: [], bookings: [], plan: { unit: "hour", feeMinor: 30_000, currency: "AED" }, now: NOW });
    expect(fresh.next.estimateMinor).toBeNull();
  });

  describe("agreements", () => {
    const cfa = { id: "a1", serviceName: "CFA Level I tuition", unit: "month" as const, rateMinor: 300_000, currency: "AED" as const, scope: "", hoursPerMonth: null, acceptedAt: null };

    it("shows the agreed fee in each covered month, months left to the exam and what is still to come", () => {
      const view = StudentAccount.build({
        entries: [entry("2026-10-01", "invoice", "AED", 250_000, 0)],
        documents: [],
        bookings: [],
        plan: { unit: "hour", feeMinor: 30_000, currency: "AED" },
        agreements: [{ ...cfa, startsOn: "2026-09-01", endsOn: "2027-02-15" }],
        now: NOW,
      });
      const month = (m: string) => view.months.find((x) => x.month === m)!;
      expect(month("2026-08").agreed).toEqual([]);
      expect(month("2026-09").agreed).toEqual([{ currency: "AED", minor: 300_000 }]);
      // Invoiced less than agreed: both show.
      expect(month("2026-10")).toMatchObject({ agreed: [{ currency: "AED", minor: 300_000 }], billed: [{ currency: "AED", minor: 250_000 }] });
      // Nov, Dec, Jan, Feb.
      expect(view.agreements[0]).toMatchObject({ monthsLeft: 4, remainingMinor: 1_200_000 });
      // The monthly agreement wins over the hourly client plan.
      expect(view.plan).toEqual({ unit: "month", feeMinor: 300_000, currency: "AED" });
      expect(view.next.estimateMinor).toBe(300_000);
    });

    it("counts a future agreement from its first month, ends at zero, and drops agreements already over", () => {
      expect(StudentAccount.agreement({ ...cfa, startsOn: "2027-01-01", endsOn: "2027-03-31" }, "2026-10")).toMatchObject({ monthsLeft: 3, remainingMinor: 900_000 });
      expect(StudentAccount.agreement({ ...cfa, startsOn: "2026-01-01", endsOn: "2026-10-31" }, "2026-10")).toMatchObject({ monthsLeft: 0 });
      expect(StudentAccount.agreement({ ...cfa, startsOn: "2026-01-01", endsOn: null }, "2026-10")).toMatchObject({ monthsLeft: null });
      expect(StudentAccount.agreement({ ...cfa, unit: "hour", startsOn: "2026-01-01", endsOn: "2027-01-01" }, "2026-10")).toMatchObject({ monthsLeft: null });
      const over = StudentAccount.build({ entries: [], documents: [], bookings: [], plan: null, agreements: [{ ...cfa, startsOn: "2026-01-01", endsOn: "2026-09-30" }], now: NOW });
      expect(over.agreements).toEqual([]);
      expect(over.plan).toBeNull();
    });
  });

  it("adds hand-logged sessions to studied and paid-for hours, skipping zero-length ones", () => {
    const view = StudentAccount.build({
      entries: [],
      documents: [doc({ hours: 10 })],
      bookings: [booking("2026-10-01T10:00:00Z", 1)],
      manual: [
        { date: "2026-10-05", minutes: 120 },
        { date: "2026-10-06", minutes: 0 },
      ],
      plan: null,
      now: NOW,
    });
    expect(view.taken).toEqual({ minutes: 180, sessions: 2 });
    expect(view.months.at(-2)).toMatchObject({ minutesTaken: 180, sessionsTaken: 2 });
    expect(view.prepaid).toEqual([{ unit: "hour", billed: 10, used: 3 }]);
  });

  it("prices 1-on-1 hours beyond the invoiced ones at the hourly rate, as not invoiced yet", () => {
    const sources = {
      entries: [],
      bookings: [booking("2026-10-01T10:00:00Z", 2), booking("2026-10-08T10:00:00Z", 3), booking("2026-10-28T10:00:00Z", 3)],
      plan: { unit: "hour" as const, feeMinor: 30_000, currency: "AED" as const },
      now: NOW,
    };
    // 5 h taken (the 28th hasn't happened), 2 invoiced: 3 h x AED 300.
    expect(StudentAccount.build({ ...sources, documents: [doc({ hours: 2 })] }).uninvoiced).toEqual({ unit: "hour", quantity: 3, amountMinor: 90_000, currency: "AED" });
    expect(StudentAccount.build({ ...sources, documents: [doc({ hours: 5 })] }).uninvoiced).toBeNull();
    expect(StudentAccount.build({ ...sources, documents: [], plan: { unit: "month", feeMinor: 300_000, currency: "AED" } }).uninvoiced).toBeNull();
    // Moved onto a monthly agreement while the client record still says hourly: the agreement covers the time.
    const monthly = { id: "m", serviceName: "CFA", unit: "month" as const, rateMinor: 300_000, currency: "AED" as const, startsOn: "2026-10-01", endsOn: null, scope: "", hoursPerMonth: 30, acceptedAt: null };
    expect(StudentAccount.build({ ...sources, documents: [], agreements: [monthly] }).uninvoiced).toBeNull();
  });
});
