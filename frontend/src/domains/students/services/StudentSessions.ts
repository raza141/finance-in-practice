import type { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import type { StudentSession } from "../types";

/** Part of a session on one day: minutes after that day's midnight. */
export interface SessionSpan {
  session: StudentSession;
  date: string;
  from: number;
  to: number;
}

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
  attendees?: readonly unknown[];
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
          group: (b.attendees?.length ?? 0) > 1,
        };
      });
  }

  /** Each session's stretch of each day it touches, in minutes after midnight in the calendar's timezone, for the week grid. */
  static daySpans(sessions: readonly StudentSession[], calendar: Pick<ZonedCalendar, "dateOf" | "timeOf">): SessionSpan[] {
    const clock = (instant: Date) => {
      const [hours, minutes] = calendar.timeOf(instant).split(":").map(Number);
      return hours * 60 + minutes;
    };
    return sessions.flatMap((session) => {
      const start = new Date(session.start);
      const last = new Date(Date.parse(session.end) - 1);
      const [date, endDate] = [calendar.dateOf(start), calendar.dateOf(last)];
      return date === endDate
        ? [{ session, date, from: clock(start), to: clock(last) + 1 }]
        : [
            { session, date, from: clock(start), to: 1440 },
            { session, date: endDate, from: 0, to: clock(last) + 1 },
          ];
    });
  }

  /** Sessions that already took place (accepted), most recent first. */
  static past(bookings: readonly BookingLike[], now: Date = new Date(), limit = 20): StudentSession[] {
    const ended = bookings.filter((b) => b.status === "accepted" && Date.parse(b.end) <= now.getTime());
    return StudentSessions.upcoming(ended, new Date(0))
      .toReversed()
      .slice(0, limit);
  }

  /**
   * The owner's record of what actually happened (049_session_log) laid over
   * ended bookings: a new length (the end moves), or 0 to drop one that didn't
   * take place. Upcoming bookings stay as booked.
   */
  static applyLog<T extends { uid: string; start: string; end: string }>(
    bookings: readonly T[],
    log: readonly { bookingUid: string | null; minutes: number }[],
    now: Date = new Date(),
  ): T[] {
    const minutes = new Map(log.flatMap((l) => (l.bookingUid ? [[l.bookingUid, l.minutes] as const] : [])));
    return bookings.flatMap((b) => {
      const actual = minutes.get(b.uid);
      if (actual === undefined || Date.parse(b.end) > now.getTime()) return [b];
      if (actual === 0) return [];
      const end = Date.parse(b.start) + actual * 60_000;
      // Logged longer just after it ended: keep it in the past (start earlier) so it never shows as upcoming.
      return end <= now.getTime()
        ? [{ ...b, end: new Date(end).toISOString() }]
        : [{ ...b, start: new Date(Date.parse(b.end) - actual * 60_000).toISOString() }];
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
