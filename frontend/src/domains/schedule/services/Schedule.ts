import type { BookingBlock, ScheduleEvent, TimeRange } from "../types";

interface BookingLike extends TimeRange {
  uid: string;
  title: string;
  status: string;
  meetingUrl: string | null;
  metadata: Record<string, string>;
  attendees: { name: string; email: string }[];
}

interface BusyLike extends TimeRange {
  source: string;
}

/**
 * Pure scheduling rules shared by the public slots API and the admin
 * Schedule page. The owner works in Dubai time.
 */
export class Schedule {
  static readonly TIME_ZONE = "Asia/Dubai";
  // ponytail: fixed offset, valid because the UAE has no DST. Use a tz library if the owner's zone changes.
  static readonly OFFSET = "+04:00";
  /** Length of the public event type (cal.com/raza141/30min). */
  static readonly SESSION_MINUTES = 30;
  static readonly TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

  static overlaps(a: TimeRange, b: TimeRange): boolean {
    return Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
  }

  /** Slots that don't touch any block. */
  static free<T extends TimeRange>(slots: T[], blocks: readonly TimeRange[]): T[] {
    return blocks.length === 0 ? slots : slots.filter((slot) => !blocks.some((b) => Schedule.overlaps(slot, b)));
  }

  /** The public session that would start at `start`. */
  static session(start: string): TimeRange {
    return { start, end: new Date(Date.parse(start) + Schedule.SESSION_MINUTES * 60_000).toISOString() };
  }

  /** Dubai wall-clock date + "HH:MM" -> ISO instant. "24:00" means the end of that day. */
  static instant(date: string, time: string): string {
    if (time === "24:00") return new Date(Date.parse(`${date}T00:00:00${Schedule.OFFSET}`) + 86_400_000).toISOString();
    return new Date(`${date}T${time}:00${Schedule.OFFSET}`).toISOString();
  }

  /** Monday of the week containing `date` (YYYY-MM-DD). */
  static weekStart(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }

  /**
   * One list for the week view. Website bookings also land in the connected
   * calendars, so calendar busy time that exactly matches a booking is the
   * same event echoed back and is dropped.
   */
  static merge(bookings: readonly BookingLike[], busy: readonly BusyLike[], blocks: readonly BookingBlock[]): ScheduleEvent[] {
    const key = (r: TimeRange) => `${Date.parse(r.start)}-${Date.parse(r.end)}`;
    const booked = new Set(bookings.filter((b) => b.status !== "cancelled").map(key));

    const events: ScheduleEvent[] = [
      ...bookings.map((b): ScheduleEvent => ({
        kind: "booking",
        id: b.uid,
        start: b.start,
        end: b.end,
        title: b.attendees[0]?.name || b.title,
        detail: b.metadata.track ? b.metadata.track.toUpperCase() : "Website booking",
        status: b.status,
        email: b.attendees[0]?.email,
        meetingUrl: b.meetingUrl,
      })),
      ...busy
        .filter((b) => !booked.has(key(b)))
        .map((b): ScheduleEvent => ({
          kind: "busy",
          id: `busy-${key(b)}`,
          start: b.start,
          end: b.end,
          title: "Busy",
          detail: b.source.replace(/-calendar$/, "") + " calendar",
        })),
      ...blocks.map((b): ScheduleEvent => ({
        kind: "block",
        id: b.id,
        start: b.start,
        end: b.end,
        title: b.reason || "Blocked",
        detail: "Blocked from admin",
      })),
    ];
    return events.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  }
}
