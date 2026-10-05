/** Article dates are instants; readers see the calendar day in Gulf Standard Time, the business's zone. */
export class JournalDates {
  static readonly ZONE = "Asia/Dubai";

  /** "4 October 2026". */
  static long(iso: string): string {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: JournalDates.ZONE }).format(new Date(iso));
  }

  /** "2026-10-04", for comparing days. */
  static day(iso: string): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: JournalDates.ZONE }).format(new Date(iso));
  }

  /** "2026-10-04 09:30" in GST, for admin lists. */
  static stamp(iso: string): string {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: JournalDates.ZONE,
    }).format(new Date(iso));
  }
}
