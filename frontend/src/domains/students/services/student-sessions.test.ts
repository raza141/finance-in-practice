import { describe, expect, it } from "vitest";

import { StudentSessions } from "./StudentSessions";

const NOW = new Date("2026-10-14T08:00:00Z");
const booking = (uid: string, start: string, hours: number, patch: Record<string, unknown> = {}) => ({
  uid,
  start,
  end: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
  status: "accepted",
  title: "Session",
  meetingUrl: null,
  location: null,
  ...patch,
});

describe("StudentSessions", () => {
  const bookings = [
    booking("past", "2026-10-01T10:00:00Z", 1, { location: "Khalifa City A, villa 12" }),
    booking("later", "2026-10-20T10:00:00Z", 2, { location: "integrations:google:meet", meetingUrl: "https://meet.google.com/abc" }),
    booking("soon", "2026-10-16T10:00:00Z", 1, { status: "pending", location: "Al Reem, Sky Tower 1503", metadata: { course: "CFA Level I" } }),
    booking("gone", "2026-10-18T10:00:00Z", 1, { status: "cancelled", location: "khalifa city a, villa 12" }),
  ];

  it("lists sessions that haven't ended, soonest first, with their length", () => {
    expect(StudentSessions.upcoming(bookings, NOW).map((s) => [s.uid, s.minutes, s.status, s.course])).toEqual([
      ["soon", 60, "pending", "CFA Level I"],
      ["later", 120, "accepted", "Session"],
    ]);
  });

  it("marks bookings with several students as group sessions", () => {
    const group = booking("mock", "2026-10-24T06:00:00Z", 3, { attendees: [{ email: "a@x.com" }, { email: "b@x.com" }] });
    expect(StudentSessions.upcoming([group, bookings[1]], NOW).map((s) => [s.uid, s.group])).toEqual([
      ["later", false],
      ["mock", true],
    ]);
  });

  it("lists past sessions, most recent first, cancelled ones left out", () => {
    expect(StudentSessions.past(bookings, NOW).map((s) => s.uid)).toEqual(["past"]);
  });

  it("remembers distinct in-person addresses, never meeting links", () => {
    expect(StudentSessions.addresses(bookings)).toEqual(["khalifa city a, villa 12", "Al Reem, Sky Tower 1503"]);
  });
});
