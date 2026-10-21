import { describe, expect, it } from "vitest";

import { Capacity } from "./Capacity";

const NOW = new Date("2026-10-21T08:00:00Z");
const b = (uid: string, email: string, start: string, hours: number, status = "accepted", more: object = {}) => ({
  uid,
  start,
  end: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
  status,
  attendees: [{ email }],
  ...more,
});
const clients = [
  { id: "ali", name: "Ali", email: "Ali@example.com" },
  { id: "sara", name: "Sara", email: "sara@example.com" },
];

describe("Capacity", () => {
  it("shows who takes the most hours for the fee", () => {
    const rows = Capacity.rows({
      clients,
      month: "2026-10",
      now: NOW,
      freeSlug: "30min",
      bookings: [
        b("1", "ali@example.com", "2026-10-02T10:00:00Z", 1),
        b("2", "ali@example.com", "2026-10-09T10:00:00Z", 1),
        b("3", "sara@example.com", "2026-10-05T10:00:00Z", 2),
        b("4", "sara@example.com", "2026-10-28T10:00:00Z", 2),
        b("5", "sara@example.com", "2026-10-06T10:00:00Z", 0.5, "accepted", { eventType: { slug: "30min" } }),
        b("6", "nobody@example.com", "2026-10-06T10:00:00Z", 3),
        b("7", "ali@example.com", "2026-09-30T10:00:00Z", 5),
      ],
      // Ali's first session ran to 3 h; one extra 2 h session logged by hand.
      log: [
        { clientId: "ali", bookingUid: "1", onDate: null, minutes: 180 },
        { clientId: "ali", bookingUid: null, onDate: "2026-10-15", minutes: 120 },
      ],
      money: [
        { clientId: "ali", currency: "USD", invoicedMinor: 0, paidMinor: 30_000 },
        { clientId: "sara", currency: "AED", invoicedMinor: 100_000, paidMinor: 100_000 },
      ],
      agreements: [
        { clientId: "ali", id: "a", serviceName: "CFA I", unit: "month", rateMinor: 30_000, currency: "USD", startsOn: "2026-09-01", endsOn: null, hoursPerMonth: 30 },
      ],
    });
    expect(rows.map((r) => [r.name, r.minutesTaught, r.sessions, r.minutesBooked])).toEqual([
      ["Ali", 360, 3, 0],
      ["Sara", 120, 1, 120],
    ]);
    expect(rows[0]).toMatchObject({ includedMinutes: 1800, perHour: { currency: "USD", minor: 5_000, basis: "agreed" } });
    expect(rows[1].perHour).toEqual({ currency: "AED", minor: 50_000, basis: "invoiced" });
  });
});
