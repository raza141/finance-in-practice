import { describe, expect, it } from "vitest";

import type { HourRequest } from "../types";
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
    const allowance = Allowance.forMonth({
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
      month: "2026-10",
      freeSlug: "30min",
      now: NOW,
    });
    expect(allowance).toMatchObject({ includedMinutes: 1800, takenMinutes: 750, bookedMinutes: 300, leftMinutes: 750, extraMinutes: 0, pending: null });
  });

  it("adds approved extra hours (included or billed), never declined or pending ones", () => {
    const allowance = Allowance.forMonth({
      agreements: [cfa],
      requests: [request("free", 2), request("billed", 3), request("declined", 10), request("pending", 4), request("free", 9, "2026-11")],
      bookings: [booking("2026-10-01T10:00:00Z", 32)],
      manual: [],
      month: "2026-10",
      now: NOW,
    });
    expect(allowance).toMatchObject({ extraMinutes: 300, extraBilledMinutes: 180, leftMinutes: 1800 + 300 - 1920 });
    expect(allowance?.pending?.hours).toBe(4);
  });

  it("applies only to monthly agreements with an hours limit that cover the month", () => {
    const base = { requests: [], bookings: [], manual: [], now: NOW };
    expect(Allowance.forMonth({ ...base, agreements: [{ ...cfa, hoursPerMonth: null }], month: "2026-10" })).toBeNull();
    expect(Allowance.forMonth({ ...base, agreements: [{ ...cfa, unit: "hour" }], month: "2026-10" })).toBeNull();
    expect(Allowance.forMonth({ ...base, agreements: [cfa], month: "2027-03" })).toBeNull();
    // The end date's month is included.
    expect(Allowance.forMonth({ ...base, agreements: [cfa], month: "2027-02" })?.includedMinutes).toBe(1800);
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
