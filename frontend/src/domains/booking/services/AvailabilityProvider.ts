import type { AvailabilityQuery, DayLiquidity, TimeSlot } from "../types";

/**
 * Source of bookable demo slots. The widget depends only on this contract;
 * Phase 3 adds a Cal.com `/v2/slots` implementation alongside the mock.
 */
export interface AvailabilityProvider {
  /** True while slots are simulated and nothing is actually reserved. */
  readonly isSimulated: boolean;
  getProjection(query: AvailabilityQuery, signal?: AbortSignal): Promise<DayLiquidity[]>;
}

/** Tutor's timezone. Gulf Standard Time has no DST, so a fixed offset is exact. */
export const TUTOR_TIMEZONE = { label: "GST", iana: "Asia/Dubai", utcOffsetHours: 4 } as const;

/**
 * Deterministic simulated availability: the same date always yields the same
 * slots (seeded by the date), so the curve is stable across renders and tests.
 */
export class MockAvailabilityProvider implements AvailabilityProvider {
  readonly isSimulated = true;

  private static readonly SESSION_TIMES = [
    "09:00", "10:30", "12:00", "14:00", "15:30", "17:00", "18:45", "20:15",
  ] as const;
  private static readonly ASK_FROM = "17:00";

  constructor(
    private readonly latencyMs = 650,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getProjection({ track, days }: AvailabilityQuery, signal?: AbortSignal): Promise<DayLiquidity[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(this.build(track, days)), this.latencyMs);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Availability request cancelled", "AbortError"));
      });
    });
  }

  private build(track: string, days: number): DayLiquidity[] {
    const todayInTutorTz = MockAvailabilityProvider.tutorDate(this.now());
    return Array.from({ length: days }, (_, i) => {
      const date = MockAvailabilityProvider.addDays(todayInTutorTz, i + 1); // from tomorrow
      return { date, slots: this.slotsFor(date, track) };
    });
  }

  private slotsFor(date: string, track: string): TimeSlot[] {
    const random = MockAvailabilityProvider.seededRandom(`${date}:${track}`);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 Sun ... 6 Sat
    const weekend = weekday === 0 || weekday === 6;
    const maxSlots = weekend ? 2 : 5;
    const count = Math.floor(random() * (maxSlots + 1));

    const pool = [...MockAvailabilityProvider.SESSION_TIMES];
    const picked: string[] = [];
    while (picked.length < count && pool.length) {
      picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }

    return picked.sort().map((label) => ({
      label,
      start: MockAvailabilityProvider.toUtcIso(date, label),
      durationMinutes: 30,
      side: label >= MockAvailabilityProvider.ASK_FROM ? "ASK" : "BID",
    }));
  }

  // --- date helpers (fixed-offset arithmetic, no locale dependence) --------

  private static tutorDate(instant: Date): string {
    const shifted = new Date(instant.getTime() + TUTOR_TIMEZONE.utcOffsetHours * 3_600_000);
    return shifted.toISOString().slice(0, 10);
  }

  private static addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
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
