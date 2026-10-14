import { describe, expect, it } from "vitest";

import { BookingValidationError } from "@/domains/booking/services/BookingContract";

import { StudentBookingContract } from "./StudentBookingContract";

const NOW = new Date("2026-10-13T08:00:00Z");
const COURSES = ["CFA® Level I", "FRM® Part I"];
const VALID = { start: "2026-10-15T14:00:00Z", timeZone: "Asia/Dubai", course: "CFA® Level I", mode: "online" };

const parse = (patch: Record<string, unknown>) => StudentBookingContract.parse({ ...VALID, ...patch }, COURSES, NOW);

describe("StudentBookingContract", () => {
  it("accepts one of the student's courses online", () => {
    expect(parse({})).toEqual({ ...VALID, start: "2026-10-15T14:00:00.000Z", topic: "", address: "", notes: "", minutes: 60, mapUrl: "" });
  });

  it("accepts Other with a topic, in person with an address", () => {
    const req = parse({ course: "Other", topic: "  Duration and convexity ", mode: "in_person", address: "Khalifa City A, villa 12" });
    expect(req).toMatchObject({ topic: "Duration and convexity", address: "Khalifa City A, villa 12" });
    expect(StudentBookingContract.summary(req)).toBe("Course: Other: Duration and convexity\nLength: 1 h\nWhere: In person: Khalifa City A, villa 12");
  });

  it("drops a topic or address that doesn't apply", () => {
    expect(parse({ minutes: 180 }).minutes).toBe(180);
    const pin = StudentBookingContract.pinLink(24.4539, 54.3773);
    expect(pin).toBe("https://www.google.com/maps?q=24.453900,54.377300");
    expect(parse({ mode: "in_person", address: "Khalifa City A, villa 12", mapUrl: pin }).mapUrl).toBe(pin);
    expect(parse({ mode: "in_person", address: "Khalifa City A, villa 12", mapUrl: "https://maps.app.goo.gl/AbC123" }).mapUrl).toBe("https://maps.app.goo.gl/AbC123");
    expect(parse({ mapUrl: pin }).mapUrl).toBe("");
    expect(parse({ topic: "ignored", address: "ignored too" })).toMatchObject({ topic: "", address: "" });
  });

  it.each([
    ["a course they don't have", { course: "CFA® Level III" }],
    ["Other without a topic", { course: "Other", topic: " " }],
    ["in person without an address", { mode: "in_person", address: "" }],
    ["an unknown mode", { mode: "phone" }],
    ["notes over the limit", { notes: "x".repeat(501) }],
    ["a past start", { start: "2026-10-12T14:00:00Z" }],
    ["a start beyond 90 days", { start: "2027-02-01T14:00:00Z" }],
    ["a bad timezone", { timeZone: "Mars/Base" }],
    ["a length Cal.com doesn't offer", { minutes: 90 }],
    ["a map link that isn't Google Maps", { mode: "in_person", address: "Khalifa City A, villa 12", mapUrl: "https://evil.example/maps" }],
    ["a google.com link outside /maps", { mode: "in_person", address: "Khalifa City A, villa 12", mapUrl: "https://www.google.com/search?q=x" }],
  ])("rejects %s", (_, patch) => {
    expect(() => parse(patch)).toThrow(BookingValidationError);
  });

  it("counts back-to-back hourly slots for longer sessions", () => {
    const at = (h: string) => ({ start: `2026-10-15T${h}:00:00Z` });
    const slots = [at("09"), at("10"), at("11"), at("13"), at("14")];
    expect(StudentBookingContract.runLength(slots, 0, 4)).toBe(3);
    expect(StudentBookingContract.runLength(slots, 0, 2)).toBe(2);
    expect(StudentBookingContract.runLength(slots, 3, 4)).toBe(2);
    expect(StudentBookingContract.runLength(slots, 9, 4)).toBe(0);
  });
});
