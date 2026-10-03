export type TrackId = "cfa" | "frm" | "uni" | "systems";

export interface BookingTrack {
  id: TrackId;
  /** Terminal-style tab label, e.g. "CFA L1/L2". */
  ticker: string;
  /** One-line description shown under the ticker. */
  blurb: string;
  title: string;
}

export type BookSide = "BID" | "ASK";

export interface TimeSlot {
  /** ISO 8601 start instant (UTC), the value a booking API will need. */
  start: string;
  /** Wall-clock label in the viewer's timezone, e.g. "14:00". */
  label: string;
  durationMinutes: number;
  /** Earlier half of the day's book is the bid side, the later half the ask. */
  side: BookSide;
}

export interface DayLiquidity {
  /** Calendar date in the viewer's timezone, YYYY-MM-DD. */
  date: string;
  slots: TimeSlot[];
}

export interface AvailabilityQuery {
  track: TrackId;
  days: number;
  /** Visitor's IANA timezone: dates and labels are expressed in it. */
  timeZone: string;
}
