import { describe, expect, it } from "vitest";

import { BookingValidationError } from "@/domains/booking/services/BookingContract";

import { StudentBookingContract } from "./StudentBookingContract";

const NOW = new Date("2026-10-13T08:00:00Z");
const COURSES = ["CFA® Level I", "FRM® Part I"];
const VALID = { start: "2026-10-15T14:00:00Z", timeZone: "Asia/Dubai", course: "CFA® Level I", mode: "online" };

const parse = (patch: Record<string, unknown>) => StudentBookingContract.parse({ ...VALID, ...patch }, COURSES, NOW);

describe("StudentBookingContract", () => {
  it("accepts one of the student's courses online", () => {
    expect(parse({})).toEqual({ ...VALID, start: "2026-10-15T14:00:00.000Z", topic: "", address: "", notes: "" });
  });

  it("accepts Other with a topic, in person with an address", () => {
    const req = parse({ course: "Other", topic: "  Duration and convexity ", mode: "in_person", address: "Khalifa City A, villa 12" });
    expect(req).toMatchObject({ topic: "Duration and convexity", address: "Khalifa City A, villa 12" });
    expect(StudentBookingContract.summary(req)).toBe("Course: Other: Duration and convexity\nWhere: In person: Khalifa City A, villa 12");
  });

  it("drops a topic or address that doesn't apply", () => {
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
  ])("rejects %s", (_, patch) => {
    expect(() => parse(patch)).toThrow(BookingValidationError);
  });
});
