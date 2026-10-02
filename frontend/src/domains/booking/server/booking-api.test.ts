import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as createRoute } from "@/app/api/booking/create/route";
import { GET as slotsRoute } from "@/app/api/booking/slots/route";

import { SlotMapper } from "../services/AvailabilityProvider";
import { BookingContract, BookingValidationError } from "../services/BookingContract";
import { ZonedCalendar } from "../services/ZonedCalendar";
import { BookingGateway } from "./BookingGateway";
import { CalComClient } from "./CalComClient";
import { SlidingWindowRateLimiter } from "./SlidingWindowRateLimiter";

const NOW = new Date("2026-10-02T09:00:00Z");
const ORIGIN = "https://financeinpractice.me";

/** Cal.com v2 slots payload for Asia/Dubai, as observed from the live API. */
const CAL_SLOTS = {
  status: "success",
  data: {
    "2026-10-05": [
      { start: "2026-10-05T09:30:00.000+04:00", end: "2026-10-05T10:00:00.000+04:00" },
      { start: "2026-10-05T09:00:00.000+04:00", end: "2026-10-05T09:30:00.000+04:00" },
    ],
  },
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// --------------------------------------------------------------------------

describe("ZonedCalendar", () => {
  it("resolves calendar dates and wall-clock times per timezone", () => {
    const instant = new Date("2026-10-02T21:30:00Z");
    expect(new ZonedCalendar("Asia/Dubai").dateOf(instant)).toBe("2026-10-03");
    expect(new ZonedCalendar("Asia/Dubai").timeOf(instant)).toBe("01:30");
    expect(new ZonedCalendar("America/New_York").dateOf(instant)).toBe("2026-10-02");
    expect(new ZonedCalendar("America/New_York").timeOf(instant)).toBe("17:30");
  });

  it("validates zones and ISO dates", () => {
    expect(ZonedCalendar.isValidTimeZone("Asia/Karachi")).toBe(true);
    expect(ZonedCalendar.isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(ZonedCalendar.isIsoDate("2026-02-29")).toBe(false);
    expect(ZonedCalendar.isIsoDate("2028-02-29")).toBe(true);
    expect(() => new ZonedCalendar("nope")).toThrow(RangeError);
  });
});

describe("SlotMapper", () => {
  it("labels UTC slots in the viewer's zone and splits BID/ASK by halves", () => {
    const wire = [
      { start: "2026-10-05T06:00:00.000Z", end: "2026-10-05T06:30:00.000Z" },
      { start: "2026-10-05T05:00:00.000Z", end: "2026-10-05T05:30:00.000Z" },
      { start: "2026-10-05T05:30:00.000Z", end: "2026-10-05T06:00:00.000Z" },
    ];
    const slots = SlotMapper.toSlots(wire, new ZonedCalendar("Asia/Karachi")); // UTC+5
    expect(slots.map((s) => s.label)).toEqual(["10:00", "10:30", "11:00"]);
    expect(slots.map((s) => s.side)).toEqual(["BID", "BID", "ASK"]);
    expect(slots.every((s) => s.durationMinutes === 30)).toBe(true);
  });
});

describe("BookingContract", () => {
  const valid = {
    start: "2026-10-05T05:00:00.000Z",
    name: "  Ada   Lovelace ",
    email: " Ada@Example.com ",
    timeZone: "Europe/London",
    track: "cfa",
  };

  it("normalises a valid booking", () => {
    expect(BookingContract.parseCreateRequest(valid, NOW)).toEqual({
      start: "2026-10-05T05:00:00.000Z",
      name: "Ada Lovelace",
      email: "ada@example.com",
      timeZone: "Europe/London",
      track: "cfa",
      company: "",
    });
  });

  it.each([
    [{ name: "A" }, "name"],
    [{ email: "not-an-email" }, "email"],
    [{ timeZone: "Nowhere/City" }, "timeZone"],
    [{ track: "crypto" }, "track"],
    [{ start: "2026-10-01T00:00:00Z" }, "future"],
    [{ start: "2027-06-01T00:00:00Z" }, "within"],
    [{ start: "yesterday" }, "ISO"],
  ])("rejects %o", (patch, message) => {
    expect(() => BookingContract.parseCreateRequest({ ...valid, ...patch }, NOW)).toThrow(
      new RegExp(message),
    );
  });

  it("parses day and range slot queries", () => {
    expect(BookingContract.parseSlotsQuery(new URLSearchParams("date=2026-10-05&timeZone=Asia/Dubai"))).toEqual({
      kind: "day",
      date: "2026-10-05",
      timeZone: "Asia/Dubai",
    });
    expect(
      BookingContract.parseSlotsQuery(new URLSearchParams("start=2026-10-02&end=2026-10-15")).kind,
    ).toBe("range");
    expect(() => BookingContract.parseSlotsQuery(new URLSearchParams("start=2026-10-02&end=2026-12-31"))).toThrow(
      BookingValidationError,
    );
    expect(() => BookingContract.parseSlotsQuery(new URLSearchParams("date=2026-13-01"))).toThrow(
      BookingValidationError,
    );
  });
});

describe("SlidingWindowRateLimiter", () => {
  it("allows N hits per window per key, then recovers", () => {
    let t = 0;
    const limiter = new SlidingWindowRateLimiter(2, 1000, () => t);
    expect([limiter.allow("a"), limiter.allow("a"), limiter.allow("a")]).toEqual([true, true, false]);
    expect(limiter.allow("b")).toBe(true);
    t = 1001;
    expect(limiter.allow("a")).toBe(true);
  });
});

describe("CalComClient + BookingGateway", () => {
  const config = { apiKey: "cal_test_key", username: "raza141", eventTypeSlug: "30min" };

  it("calls Cal.com slots with the documented version header and normalises to UTC", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(200, CAL_SLOTS));
    const gateway = new BookingGateway(new CalComClient(config, fetchImpl));

    const range = await gateway.range("2026-10-04", "2026-10-06", "Asia/Dubai");

    const [url, init] = fetchImpl.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe("https://api.cal.com/v2/slots");
    expect(Object.fromEntries(parsed.searchParams)).toMatchObject({
      username: "raza141",
      eventTypeSlug: "30min",
      start: "2026-10-04",
      end: "2026-10-06",
      timeZone: "Asia/Dubai",
    });
    const headers = init?.headers as Record<string, string>;
    expect(headers["cal-api-version"]).toBe("2024-09-04");
    expect(headers.Authorization).toBe("Bearer cal_test_key");

    expect(range.days.map((d) => d.date)).toEqual(["2026-10-04", "2026-10-05", "2026-10-06"]);
    expect(range.days[0].slots).toEqual([]);
    expect(range.days[1].slots).toEqual([
      { start: "2026-10-05T05:00:00.000Z", end: "2026-10-05T05:30:00.000Z" },
      { start: "2026-10-05T05:30:00.000Z", end: "2026-10-05T06:00:00.000Z" },
    ]);
  });

  it("creates bookings with the bookings API version and attendee payload", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json(201, {
        status: "success",
        data: { uid: "abc123", start: "2026-10-05T05:00:00.000Z", end: "2026-10-05T05:30:00.000Z", status: "accepted" },
      }),
    );
    const gateway = new BookingGateway(new CalComClient(config, fetchImpl));
    const result = await gateway.create({
      start: "2026-10-05T05:00:00.000Z",
      name: "Ada Lovelace",
      email: "ada@example.com",
      timeZone: "Europe/London",
      track: "frm",
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://api.cal.com/v2/bookings");
    expect((init?.headers as Record<string, string>)["cal-api-version"]).toBe("2026-02-25");
    expect(JSON.parse(String(init?.body))).toEqual({
      start: "2026-10-05T05:00:00.000Z",
      attendee: { name: "Ada Lovelace", email: "ada@example.com", timeZone: "Europe/London", language: "en" },
      metadata: { track: "frm", source: "financeinpractice.me" },
      username: "raza141",
      eventTypeSlug: "30min",
    });
    expect(result).toEqual({
      uid: "abc123",
      start: "2026-10-05T05:00:00.000Z",
      end: "2026-10-05T05:30:00.000Z",
      status: "accepted",
    });
  });

  it("maps Cal.com rejections to SLOT_UNAVAILABLE without leaking upstream detail", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () =>
      json(400, { status: "error", error: { code: "BadRequestException", message: "User either already has booking at this time or is not available" } }),
    );
    const gateway = new BookingGateway(new CalComClient(config, fetchImpl));
    const failure = await gateway
      .create({ start: "2026-10-05T05:00:00.000Z", name: "Ada", email: "a@b.co", timeZone: "UTC", track: "uni" })
      .catch((e) => e);
    expect(BookingGateway.errorResponse(failure)).toEqual({
      status: 409,
      body: { error: "SLOT_UNAVAILABLE", message: "That slot is no longer available. Please pick another time." },
    });
  });
});

// --------------------------------------------------------------------------

describe("API routes", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("CAL_API_KEY", "cal_test_key");
    vi.stubEnv("NEXT_PUBLIC_CAL_LINK", "raza141/30min");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = realFetch;
    vi.useRealTimers();
  });

  const post = (body: unknown, headers: Record<string, string> = { origin: ORIGIN }) =>
    new NextRequest(`${ORIGIN}/api/booking/create`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.random() * 250 | 0}`, ...headers },
    });

  it("GET /slots returns a day's UTC slots and never caches", async () => {
    globalThis.fetch = vi.fn(async () => json(200, CAL_SLOTS)) as typeof fetch;
    const res = await slotsRoute(new NextRequest(`${ORIGIN}/api/booking/slots?date=2026-10-05&timeZone=Asia/Dubai`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      date: "2026-10-05",
      timeZone: "Asia/Dubai",
      slots: [
        { start: "2026-10-05T05:00:00.000Z", end: "2026-10-05T05:30:00.000Z" },
        { start: "2026-10-05T05:30:00.000Z", end: "2026-10-05T06:00:00.000Z" },
      ],
    });
  });

  it("GET /slots rejects bad input with 400 and missing config with 503", async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const bad = await slotsRoute(new NextRequest(`${ORIGIN}/api/booking/slots?date=tomorrow`));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("INVALID_REQUEST");
    expect(globalThis.fetch).not.toHaveBeenCalled();

    vi.stubEnv("CAL_API_KEY", "");
    const unconfigured = await slotsRoute(new NextRequest(`${ORIGIN}/api/booking/slots?date=2026-10-05`));
    expect(unconfigured.status).toBe(503);
  });

  it("POST /create returns 200 with the booking when Cal.com accepts", async () => {
    globalThis.fetch = vi.fn(async () =>
      json(201, { status: "success", data: { uid: "u1", start: "2030-01-07T05:00:00.000Z", end: "2030-01-07T05:30:00.000Z", status: "accepted" } }),
    ) as typeof fetch;
    vi.useFakeTimers({ now: new Date("2030-01-01T00:00:00Z"), toFake: ["Date"] });
    const res = await createRoute(
      post({ start: "2030-01-07T05:00:00.000Z", name: "Ada Lovelace", email: "ada@example.com", timeZone: "UTC", track: "cfa" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ uid: "u1", status: "accepted" });
  });

  it("POST /create blocks cross-origin requests and honeypot submissions before Cal.com", async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const crossSite = await createRoute(post({}, { origin: "https://evil.example" }));
    expect(crossSite.status).toBe(403);
    const noOrigin = await createRoute(post({}, {}));
    expect(noOrigin.status).toBe(403);

    vi.useFakeTimers({ now: new Date("2030-01-01T00:00:00Z"), toFake: ["Date"] });
    const bot = await createRoute(
      post({ start: "2030-01-07T05:00:00.000Z", name: "Bot Bot", email: "bot@spam.io", timeZone: "UTC", track: "cfa", company: "ACME" }),
    );
    expect(bot.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("POST /create rate-limits a single client", async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const fixedIp = { origin: ORIGIN, "x-forwarded-for": "203.0.113.9" };
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await createRoute(post({}, fixedIp))).status);
    expect(statuses.slice(0, 5).every((s) => s === 400)).toBe(true); // invalid body, but counted
    expect(statuses[5]).toBe(429);
  });
});
