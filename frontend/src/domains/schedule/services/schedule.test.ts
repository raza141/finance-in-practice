import { describe, expect, it } from "vitest";

import { BookingGateway } from "@/domains/booking/server/BookingGateway";
import { CalComClient } from "@/domains/booking/server/CalComClient";

import { BlockContract } from "./BlockContract";
import { Schedule } from "./Schedule";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("Schedule", () => {
  it("converts Dubai wall-clock time to UTC", () => {
    expect(Schedule.instant("2026-10-05", "09:00")).toBe("2026-10-05T05:00:00.000Z");
    expect(Schedule.instant("2026-10-05", "24:00")).toBe("2026-10-05T20:00:00.000Z");
  });

  it("finds the Monday of a week", () => {
    expect(Schedule.weekStart("2026-10-05")).toBe("2026-10-05");
    expect(Schedule.weekStart("2026-10-11")).toBe("2026-10-05");
  });

  it("drops slots touching a block, keeps back-to-back ones", () => {
    const slots = [
      { start: "2026-10-05T05:00:00.000Z", end: "2026-10-05T05:30:00.000Z" },
      { start: "2026-10-05T05:30:00.000Z", end: "2026-10-05T06:00:00.000Z" },
      { start: "2026-10-05T06:00:00.000Z", end: "2026-10-05T06:30:00.000Z" },
    ];
    const block = { start: "2026-10-05T05:15:00.000Z", end: "2026-10-05T06:00:00.000Z" };
    expect(Schedule.free(slots, [block]).map((s) => s.start)).toEqual(["2026-10-05T06:00:00.000Z"]);
  });

  it("merges sources and drops calendar echoes of bookings", () => {
    const booking = {
      uid: "abc123",
      title: "30 min",
      status: "accepted",
      start: "2026-10-05T08:00:00.000Z",
      end: "2026-10-05T08:30:00.000Z",
      meetingUrl: null,
      metadata: { track: "cfa" },
      attendees: [{ name: "Khawla", email: "k@example.com" }],
    };
    const busy = [
      { start: "2026-10-05T08:00:00.000Z", end: "2026-10-05T08:30:00.000Z", source: "google-calendar" },
      { start: "2026-10-07T11:00:00.000Z", end: "2026-10-07T12:00:00.000Z", source: "apple-calendar" },
    ];
    const events = Schedule.merge([booking], busy, [{ id: "b1", start: "2026-10-06T05:00:00.000Z", end: "2026-10-06T06:00:00.000Z", reason: "" }]);
    expect(events.map((e) => [e.kind, e.title])).toEqual([
      ["booking", "Khawla"],
      ["block", "Blocked"],
      ["busy", "Busy"],
    ]);
  });
});

describe("BlockContract", () => {
  it("parses a timed block and a multi-day all-day block", () => {
    expect(BlockContract.parse(form({ date: "2026-10-05", from: "14:00", to: "16:30", reason: "Offline client" }))).toEqual({
      ok: true,
      range: { start: "2026-10-05T10:00:00.000Z", end: "2026-10-05T12:30:00.000Z" },
      reason: "Offline client",
    });
    expect(BlockContract.parse(form({ date: "2026-10-05", until: "2026-10-07", allDay: "on" }))).toMatchObject({
      ok: true,
      range: { start: "2026-10-04T20:00:00.000Z", end: "2026-10-07T20:00:00.000Z" },
    });
  });

  it("rejects bad input", () => {
    expect(BlockContract.parse(form({ date: "2026-10-05", from: "16:00", to: "14:00" })).ok).toBe(false);
    expect(BlockContract.parse(form({ date: "nope", from: "09:00", to: "10:00" })).ok).toBe(false);
    expect(BlockContract.parse(form({ date: "2026-10-05", until: "2026-12-01", allDay: "on" })).ok).toBe(false);
  });
});

describe("BookingGateway with blocks", () => {
  const cal = new CalComClient(
    { apiKey: "test", username: "u", eventTypeSlug: "30min" },
    async () =>
      new Response(
        JSON.stringify({
          status: "success",
          data: {
            "2026-10-05": [
              { start: "2026-10-05T09:00:00.000+04:00", end: "2026-10-05T09:30:00.000+04:00" },
              { start: "2026-10-05T10:00:00.000+04:00", end: "2026-10-05T10:30:00.000+04:00" },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
  const block = { start: "2026-10-05T05:00:00.000Z", end: "2026-10-05T05:30:00.000Z" };
  const blocks = { between: async (from: string, to: string) => (Schedule.overlaps(block, { start: from, end: to }) ? [block] : []) };

  it("hides blocked slots", async () => {
    const day = await new BookingGateway(cal, blocks).day("2026-10-05", "Asia/Dubai");
    expect(day.slots.map((s) => s.start)).toEqual(["2026-10-05T06:00:00.000Z"]);
  });

  it("refuses to book a blocked slot", async () => {
    const request = { start: "2026-10-05T05:00:00.000Z", name: "A", email: "a@example.com", timeZone: "Asia/Dubai", track: "cfa" as const };
    const error = await new BookingGateway(cal, blocks).create(request).catch((e: unknown) => e);
    expect(BookingGateway.errorResponse(error).status).toBe(409);
  });
});
