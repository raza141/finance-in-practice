/**
 * Calendar arithmetic in an IANA timezone using only `Intl` (no libraries).
 * Shared by the browser (visitor's zone) and the API routes (validation).
 */
export class ZonedCalendar {
  constructor(readonly timeZone: string) {
    if (!ZonedCalendar.isValidTimeZone(timeZone)) {
      throw new RangeError(`Invalid timeZone: ${timeZone}`);
    }
  }

  /** The visitor's IANA timezone, e.g. "Asia/Dubai" (browser only). */
  static visitorTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }

  static isValidTimeZone(timeZone: unknown): timeZone is string {
    if (typeof timeZone !== "string" || timeZone.length === 0 || timeZone.length > 64) return false;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
      return true;
    } catch {
      return false;
    }
  }

  static isIsoDate(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }

  static addDays(isoDate: string, days: number): string {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  static daysBetween(from: string, to: string): number {
    return Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
    );
  }

  /** Calendar date (YYYY-MM-DD) of an instant, as seen in this timezone. */
  dateOf(instant: Date): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: this.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  today(now: Date = new Date()): string {
    return this.dateOf(now);
  }

  /** 24h wall-clock time of an instant in this timezone, e.g. "14:00". */
  timeOf(instant: Date): string {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: this.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(instant);
  }

  /** Short zone label for an instant, e.g. "GMT+4" or "EDT". */
  abbreviation(instant: Date = new Date()): string {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone: this.timeZone,
      timeZoneName: "short",
    })
      .formatToParts(instant)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? this.timeZone;
  }
}
