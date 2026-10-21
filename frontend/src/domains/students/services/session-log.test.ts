import { describe, expect, it } from "vitest";

import { SessionLogContract } from "./SessionLogContract";
import { StudentSessions } from "./StudentSessions";

const TODAY = "2026-10-21";

describe("SessionLogContract", () => {
  it("turns hours into minutes for a booking or a hand-logged day", () => {
    expect(SessionLogContract.parse({ hours: "1.5", bookingUid: "abc", note: " moved to 2 h " }, TODAY)).toEqual({
      ok: true,
      value: { bookingUid: "abc", onDate: null, minutes: 90, note: "moved to 2 h" },
    });
    expect(SessionLogContract.parse({ hours: "0", bookingUid: "abc" }, TODAY)).toMatchObject({ ok: true, value: { minutes: 0 } });
    expect(SessionLogContract.parse({ hours: "2", onDate: "2026-10-20" }, TODAY)).toMatchObject({ ok: true, value: { onDate: "2026-10-20", minutes: 120 } });
  });

  it("refuses bad hours, future days, both or neither", () => {
    for (const fields of [
      { hours: "", bookingUid: "a" },
      { hours: "-1", bookingUid: "a" },
      { hours: "11", bookingUid: "a" },
      { hours: "1.555", bookingUid: "a" },
      { hours: "abc", bookingUid: "a" },
      { hours: "1", onDate: "2026-10-22" },
      { hours: "1", onDate: "2026-13-01" },
      { hours: "1" },
      { hours: "1", bookingUid: "a", onDate: "2026-10-20" },
      { hours: "1", bookingUid: "a", note: "x".repeat(201) },
    ]) {
      expect(SessionLogContract.parse(fields, TODAY).ok).toBe(false);
    }
  });
});

describe("StudentSessions.applyLog", () => {
  const b = (uid: string, start: string, hours: number, status = "accepted") => ({
    uid,
    start,
    end: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
    status,
  });
  const NOW = new Date("2026-10-21T08:00:00Z");

  it("sets an ended session's real length and drops one that didn't happen", () => {
    const out = StudentSessions.applyLog(
      [b("long", "2026-10-10T10:00:00Z", 1), b("none", "2026-10-11T10:00:00Z", 1), b("same", "2026-10-12T10:00:00Z", 1), b("soon", "2026-10-25T10:00:00Z", 1)],
      [
        { bookingUid: "long", minutes: 120 },
        { bookingUid: "none", minutes: 0 },
        { bookingUid: "soon", minutes: 300 },
      ],
      NOW,
    );
    expect(out.map((x) => [x.uid, (Date.parse(x.end) - Date.parse(x.start)) / 60_000])).toEqual([
      ["long", 120],
      ["same", 60],
      // Not over yet: still as booked.
      ["soon", 60],
    ]);
  });

  it("never turns a just-ended session into an upcoming one", () => {
    const [out] = StudentSessions.applyLog([b("late", "2026-10-21T06:30:00Z", 1)], [{ bookingUid: "late", minutes: 180 }], NOW);
    expect(out.end).toBe("2026-10-21T07:30:00.000Z");
    expect((Date.parse(out.end) - Date.parse(out.start)) / 60_000).toBe(180);
  });
});
