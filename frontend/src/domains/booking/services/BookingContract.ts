import type { TrackId } from "../types";
import { ZonedCalendar } from "./ZonedCalendar";

/**
 * Wire contract between the booking widget and our `/api/booking/*` routes,
 * plus the validation both sides apply. Pure: safe to import anywhere.
 */

export interface SlotWire {
  /** UTC ISO instant, e.g. "2026-10-05T05:00:00.000Z". */
  start: string;
  end: string;
}

export interface DaySlotsResponse {
  date: string;
  timeZone: string;
  slots: SlotWire[];
}

export interface RangeSlotsResponse {
  start: string;
  end: string;
  timeZone: string;
  days: { date: string; slots: SlotWire[] }[];
}

export interface CreateBookingRequest {
  start: string;
  name: string;
  email: string;
  /** Optional, saved on the client record (not sent to Cal.com). */
  phone?: string;
  timeZone: string;
  track: TrackId;
  /** Honeypot: must stay empty. Bots that auto-fill every field are dropped. */
  company?: string;
}

export interface CreateBookingResponse {
  uid: string;
  start: string;
  end: string;
  status: string;
}

export interface BookingErrorBody {
  error: BookingErrorCode;
  message: string;
}

export type BookingErrorCode =
  | "INVALID_REQUEST"
  | "SLOT_UNAVAILABLE"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "NOT_CONFIGURED"
  | "UPSTREAM_ERROR";

export class BookingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingValidationError";
  }
}

const TRACKS: readonly TrackId[] = ["cfa", "frm", "uni", "systems"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s().-]{6,30}$/;

export class BookingContract {
  static readonly MAX_RANGE_DAYS = 31;
  static readonly MAX_ADVANCE_DAYS = 90;

  /** Parse `?date=` or `?start=&end=` plus `timeZone` from a slots query. */
  static parseSlotsQuery(params: URLSearchParams):
    | { kind: "day"; date: string; timeZone: string }
    | { kind: "range"; start: string; end: string; timeZone: string } {
    const timeZone = params.get("timeZone") ?? "UTC";
    if (!ZonedCalendar.isValidTimeZone(timeZone)) {
      throw new BookingValidationError("timeZone must be a valid IANA zone, e.g. Asia/Dubai");
    }

    const date = params.get("date");
    if (date !== null) {
      if (!ZonedCalendar.isIsoDate(date)) throw new BookingValidationError("date must be YYYY-MM-DD");
      return { kind: "day", date, timeZone };
    }

    const start = params.get("start");
    const end = params.get("end");
    if (!ZonedCalendar.isIsoDate(start) || !ZonedCalendar.isIsoDate(end)) {
      throw new BookingValidationError("provide date=YYYY-MM-DD, or start and end as YYYY-MM-DD");
    }
    const span = ZonedCalendar.daysBetween(start, end);
    if (span < 0 || span >= BookingContract.MAX_RANGE_DAYS) {
      throw new BookingValidationError(
        `end must be on or after start, within ${BookingContract.MAX_RANGE_DAYS} days`,
      );
    }
    return { kind: "range", start, end, timeZone };
  }

  /** Validate and normalise an untrusted booking body. */
  static parseCreateRequest(body: unknown, now: Date = new Date()): CreateBookingRequest {
    if (!body || typeof body !== "object") throw new BookingValidationError("body must be a JSON object");
    const b = body as Record<string, unknown>;

    const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < 2 || name.length > 100) {
      throw new BookingValidationError("name must be 2–100 characters");
    }

    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (email.length > 254 || !EMAIL.test(email)) {
      throw new BookingValidationError("email must be a valid address");
    }

    const phone = typeof b.phone === "string" ? b.phone.trim() : "";
    if (phone && !PHONE.test(phone)) throw new BookingValidationError("phone must be a phone number, e.g. +971 50 123 4567");

    if (!ZonedCalendar.isValidTimeZone(b.timeZone)) {
      throw new BookingValidationError("timeZone must be a valid IANA zone");
    }

    if (typeof b.track !== "string" || !TRACKS.includes(b.track as TrackId)) {
      throw new BookingValidationError("track is not recognised");
    }

    const start = typeof b.start === "string" ? new Date(b.start) : new Date(Number.NaN);
    if (Number.isNaN(start.getTime())) throw new BookingValidationError("start must be an ISO datetime");
    if (start.getTime() <= now.getTime()) throw new BookingValidationError("start must be in the future");
    if (start.getTime() - now.getTime() > BookingContract.MAX_ADVANCE_DAYS * 86_400_000) {
      throw new BookingValidationError(`start must be within ${BookingContract.MAX_ADVANCE_DAYS} days`);
    }

    return {
      start: start.toISOString(),
      name,
      email,
      phone,
      timeZone: b.timeZone,
      track: b.track as TrackId,
      company: typeof b.company === "string" ? b.company : "",
    };
  }

  static isPhone(value: string): boolean {
    return PHONE.test(value.trim());
  }

  static isEmail(value: string): boolean {
    return value.length <= 254 && EMAIL.test(value.trim());
  }
}
