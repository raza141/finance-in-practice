import { describe, expect, it } from "vitest";

import type { HourRequest } from "../types";
import { AgreementPeriod } from "./AgreementPeriod";
import { Allowance } from "./Allowance";
import { HourRequestContract } from "./HourRequestContract";

const NOW = new Date("2026-10-21T08:00:00Z");
const booking = (start: string, hours: number, status = "accepted", patch: object = {}) => ({
  start,
  end: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
  status,
  ...patch,
});
const cfa = { id: "a1", serviceName: "CFA Level I tuition", unit: "month" as const, startsOn: "2026-09-01", endsOn: "2027-02-15", hoursPerMonth: 30 };
const request = (status: HourRequest["status"], hours: number, month = "2026-10"): HourRequest => ({
  id: `r-${status}-${hours}`,
  agreementId: "a1",
  month,
  hours,
  note: "",
  status,
  createdAt: NOW,
});

describe("Allowance", () => {
  it("counts this month's 1-on-1 time taken and booked against the hours included", () => {
    const allowance = Allowance.forDate({
      agreements: [cfa],
      requests: [],
      bookings: [
        booking("2026-10-01T10:00:00Z", 10),
        booking("2026-10-25T10:00:00Z", 5, "pending"),
        booking("2026-10-03T10:00:00Z", 2, "cancelled"),
        booking("2026-10-04T10:00:00Z", 3, "accepted", { attendees: [{}, {}] }),
        booking("2026-10-05T10:00:00Z", 1, "accepted", { eventType: { slug: "30min" } }),
        // September: last month's hours never carry over.
        booking("2026-09-10T10:00:00Z", 4),
      ],
      manual: [{ date: "2026-10-12", minutes: 150 }],
      date: "2026-10-21",
      freeSlug: "30min",
      now: NOW,
    });
    expect(allowance).toMatchObject({ includedMinutes: 1800, takenMinutes: 750, bookedMinutes: 300, leftMinutes: 750, extraMinutes: 0, pending: null });
  });

  it("adds approved extra hours (included or billed), never declined or pending ones", () => {
    const allowance = Allowance.forDate({
      agreements: [cfa],
      requests: [request("free", 2), request("billed", 3), request("declined", 10), request("pending", 4), request("free", 9, "2026-11")],
      bookings: [booking("2026-10-01T10:00:00Z", 32)],
      manual: [],
      date: "2026-10-21",
      now: NOW,
    });
    expect(allowance).toMatchObject({ extraMinutes: 300, extraBilledMinutes: 180, leftMinutes: 1800 + 300 - 1920 });
    expect(allowance?.pending?.hours).toBe(4);
  });

  it("applies only to monthly agreements with an hours limit that cover the month", () => {
    const base = { requests: [], bookings: [], manual: [], now: NOW };
    expect(Allowance.forDate({ ...base, agreements: [{ ...cfa, hoursPerMonth: null }], date: "2026-10-21" })).toBeNull();
    expect(Allowance.forDate({ ...base, agreements: [{ ...cfa, unit: "hour" }], date: "2026-10-21" })).toBeNull();
    expect(Allowance.forDate({ ...base, agreements: [cfa], date: "2027-02-16" })).toBeNull();
    // The last, shorter month (1 – 15 Feb) still has the full hours.
    expect(Allowance.forDate({ ...base, agreements: [cfa], date: "2027-02-15" })).toMatchObject({ includedMinutes: 1800, periodStart: "2027-02-01", periodEnd: "2027-02-15" });
  });
});

describe("agreement months", () => {
  // Shamma: one month, 17 Oct to 14 Nov.
  const shamma = { ...cfa, startsOn: "2026-10-17", endsOn: "2026-11-14" };

  it("runs from the start date and doesn't reset on the 1st", () => {
    const allowance = Allowance.forDate({
      agreements: [shamma],
      requests: [request("free", 2, "2026-10")],
      bookings: [booking("2026-10-18T10:00:00Z", 3), booking("2026-11-03T10:00:00Z", 4, "pending"), booking("2026-10-16T10:00:00Z", 5)],
      manual: [],
      date: "2026-11-02",
      now: new Date("2026-11-02T08:00:00Z"),
    });
    // 18 Oct (3 h) and 3 Nov (4 h) are the same agreement month; 16 Oct is before it started.
    expect(allowance).toMatchObject({ month: "2026-10", periodStart: "2026-10-17", periodEnd: "2026-11-14", takenMinutes: 180, bookedMinutes: 240, extraMinutes: 120 });
  });

  it("steps months from the start date, clamping short months", () => {
    expect(AgreementPeriod.all(shamma)).toEqual([{ index: 0, start: "2026-10-17", end: "2026-11-14" }]);
    const jan31 = { startsOn: "2027-01-31", endsOn: "2027-04-15" };
    expect(AgreementPeriod.all(jan31).map((p) => [p.start, p.end])).toEqual([
      ["2027-01-31", "2027-02-27"],
      ["2027-02-28", "2027-03-30"],
      ["2027-03-31", "2027-04-15"],
    ]);
    expect(AgreementPeriod.at(jan31, "2027-03-30")?.index).toBe(1);
    expect(AgreementPeriod.at({ startsOn: "2026-10-17", endsOn: null }, "2027-10-20")).toMatchObject({ index: 12, start: "2027-10-17", end: "2027-11-16" });
    expect(AgreementPeriod.count({ startsOn: "2026-10-17", endsOn: null })).toBeNull();
    expect(AgreementPeriod.daysLeft("2026-10-21", "2026-11-14")).toBe(24);
  });
});

describe("HourRequestContract", () => {
  const allowed = ["2026-10", "2026-11"];
  it("accepts extra hours for this month or next", () => {
    expect(HourRequestContract.parse({ month: "2026-10", hours: "4.5", note: " mock week " }, allowed)).toEqual({ ok: true, value: { month: "2026-10", hours: 4.5, note: "mock week" } });
  });
  it.each([
    [{ month: "2026-12", hours: "2" }],
    [{ month: "2026-10", hours: "0" }],
    [{ month: "2026-10", hours: "101" }],
    [{ month: "2026-10", hours: "1.234" }],
    [{ month: "2026-10", hours: "2", note: "x".repeat(301) }],
  ])("refuses %o", (fields) => {
    expect(HourRequestContract.parse(fields, allowed).ok).toBe(false);
  });
});
