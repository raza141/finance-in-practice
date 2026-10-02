import type { AvailabilityQuery, DayLiquidity, TimeSlot } from "../types";
import { BookingApiClient } from "./BookingApiClient";
import type { SlotWire } from "./BookingContract";
import { ZonedCalendar } from "./ZonedCalendar";

/**
 * Source of bookable demo slots. The widget depends only on this contract.
 * Dates are calendar days and labels are wall-clock times in `timeZone`.
 */
export interface AvailabilityProvider {
  /** True while slots are simulated and nothing is actually reserved. */
  readonly isSimulated: boolean;
  getProjection(query: AvailabilityQuery, signal?: AbortSignal): Promise<DayLiquidity[]>;
  getDay(date: string, timeZone: string, signal?: AbortSignal): Promise<DayLiquidity>;
}

/** Shared mapping from UTC wire slots to display slots in a timezone. */
export class SlotMapper {
  /** Earlier half of a day's book is the BID side, the later half the ASK side. */
  static toSlots(wire: SlotWire[], calendar: ZonedCalendar): TimeSlot[] {
    const sorted = [...wire].sort((a, b) => a.start.localeCompare(b.start));
    const bidCount = Math.ceil(sorted.length / 2);
    return sorted.map((slot, i) => ({
      start: slot.start,
      label: calendar.timeOf(new Date(slot.start)),
      durationMinutes: Math.round((Date.parse(slot.end) - Date.parse(slot.start)) / 60_000),
      side: i < bidCount ? "BID" : "ASK",
    }));
  }
}

/** Live availability from Cal.com via our server routes (API key stays server-side). */
export class CalAvailabilityProvider implements AvailabilityProvider {
  readonly isSimulated = false;

  constructor(private readonly api: BookingApiClient = new BookingApiClient()) {}

  async getProjection(
    { days, timeZone }: AvailabilityQuery,
    signal?: AbortSignal,
  ): Promise<DayLiquidity[]> {
    const calendar = new ZonedCalendar(timeZone);
    const start = calendar.today();
    const end = ZonedCalendar.addDays(start, days - 1);
    const response = await this.api.range(start, end, timeZone, { signal });
    return response.days.map((day) => ({
      date: day.date,
      slots: SlotMapper.toSlots(day.slots, calendar),
    }));
  }

  async getDay(date: string, timeZone: string, signal?: AbortSignal): Promise<DayLiquidity> {
    const response = await this.api.day(date, timeZone, { signal });
    return { date, slots: SlotMapper.toSlots(response.slots, new ZonedCalendar(timeZone)) };
  }
}

/** Tutor's timezone, used by the simulated provider. */
export const TUTOR_TIMEZONE = { label: "GST", iana: "Asia/Dubai", utcOffsetHours: 4 } as const;

/**
 * Deterministic simulated availability for tests and offline development:
 * the same date always yields the same slots (seeded by the date).
 */
export class MockAvailabilityProvider implements AvailabilityProvider {
  readonly isSimulated = true;

  private static readonly SESSION_TIMES = [
    "09:00", "10:30", "12:00", "14:00", "15:30", "17:00", "18:45", "20:15",
  ] as const;

  constructor(
    private readonly latencyMs = 650,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getProjection({ track, days }: AvailabilityQuery, signal?: AbortSignal): Promise<DayLiquidity[]> {
    return this.delay(signal, () => {
      const today = MockAvailabilityProvider.tutorDate(this.now());
      return Array.from({ length: days }, (_, i) => {
        const date = ZonedCalendar.addDays(today, i + 1); // from tomorrow
        return { date, slots: this.slotsFor(date, track) };
      });
    });
  }

  getDay(date: string, _timeZone: string, signal?: AbortSignal): Promise<DayLiquidity> {
    return this.delay(signal, () => ({ date, slots: this.slotsFor(date, "any") }));
  }

  private delay<T>(signal: AbortSignal | undefined, build: () => T): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(build()), this.latencyMs);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Availability request cancelled", "AbortError"));
      });
    });
  }

  private slotsFor(date: string, track: string): TimeSlot[] {
    const random = MockAvailabilityProvider.seededRandom(`${date}:${track}`);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 Sun ... 6 Sat
    const maxSlots = weekday === 0 || weekday === 6 ? 2 : 5;
    const count = Math.floor(random() * (maxSlots + 1));

    const pool = [...MockAvailabilityProvider.SESSION_TIMES];
    const picked: string[] = [];
    while (picked.length < count && pool.length) {
      picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }

    const wire = picked.map((label) => {
      const start = MockAvailabilityProvider.toUtcIso(date, label);
      return { start, end: new Date(Date.parse(start) + 30 * 60_000).toISOString() };
    });
    return SlotMapper.toSlots(wire, new ZonedCalendar(TUTOR_TIMEZONE.iana));
  }

  private static tutorDate(instant: Date): string {
    const shifted = new Date(instant.getTime() + TUTOR_TIMEZONE.utcOffsetHours * 3_600_000);
    return shifted.toISOString().slice(0, 10);
  }

  private static toUtcIso(date: string, time: string): string {
    const local = new Date(`${date}T${time}:00Z`).getTime();
    return new Date(local - TUTOR_TIMEZONE.utcOffsetHours * 3_600_000).toISOString();
  }

  /** mulberry32 seeded from a string hash. */
  private static seededRandom(seed: string): () => number {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
}
