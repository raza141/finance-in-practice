import type { StudentSession } from "../types";

/** The parts of a Cal.com booking the student portal reads. */
interface BookingLike {
  uid: string;
  start: string;
  end: string;
  status: string;
  title: string;
  meetingUrl: string | null;
  location?: string | null;
  metadata?: Record<string, string>;
}

/** Pure reads over a student's Cal.com bookings: what is coming up, and where they met in person before. */
export class StudentSessions {
  static readonly MAX_ADDRESSES = 3;

  /** Accepted or pending sessions that haven't ended, soonest first. */
  static upcoming(bookings: readonly BookingLike[], now: Date = new Date()): StudentSession[] {
    return bookings
      .filter((b) => (b.status === "accepted" || b.status === "pending") && Date.parse(b.end) > now.getTime())
      .toSorted((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .map((b) => {
        const address = StudentSessions.address(b.location);
        return {
          uid: b.uid,
          start: b.start,
          end: b.end,
          minutes: Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60_000),
          course: b.metadata?.course || b.title,
          status: b.status === "pending" ? "pending" : "accepted",
          meetingUrl: b.meetingUrl?.startsWith("https://") ? b.meetingUrl : null,
          address,
        };
      });
  }

  /** Distinct in-person addresses, most recent first, to offer again on the next booking. */
  static addresses(bookings: readonly BookingLike[]): string[] {
    const seen = new Map<string, string>();
    for (const b of bookings.toSorted((x, y) => Date.parse(y.start) - Date.parse(x.start))) {
      const address = StudentSessions.address(b.location);
      if (address && !seen.has(address.toLowerCase())) seen.set(address.toLowerCase(), address);
    }
    return [...seen.values()].slice(0, StudentSessions.MAX_ADDRESSES);
  }

  /** An address, not a meeting link or an integration key such as "integrations:google:meet". */
  private static address(location: string | null | undefined): string | null {
    const value = location?.trim() ?? "";
    if (value.length < 5 || /^(https?:|integrations?:)/i.test(value) || /meet\.google|cal\.com|cal-video/i.test(value)) return null;
    return value;
  }
}
