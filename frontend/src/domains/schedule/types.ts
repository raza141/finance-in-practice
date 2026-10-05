export interface TimeRange {
  /** ISO instant. */
  start: string;
  /** ISO instant, exclusive. */
  end: string;
}

export interface BookingBlock extends TimeRange {
  id: string;
  reason: string;
}

export type ScheduleEventKind = "booking" | "busy" | "block";

/** One item on the admin week view, from whichever source it came. */
export interface ScheduleEvent extends TimeRange {
  kind: ScheduleEventKind;
  /** Booking uid, block id, or a synthetic key for calendar busy time. */
  id: string;
  title: string;
  detail: string;
  /** Bookings only. */
  status?: string;
  email?: string;
  meetingUrl?: string | null;
}
