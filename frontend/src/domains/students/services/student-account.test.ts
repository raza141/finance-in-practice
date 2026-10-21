import { describe, expect, it } from "vitest";

import type { ClientDocument, LedgerEntry } from "@/domains/invoices/types";

import { StudentAccount } from "./StudentAccount";

const NOW = new Date("2026-10-21T08:00:00Z");
const booking = (start: string, hours: number, status = "accepted") => ({
  start,
  end: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
  status,
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
});
