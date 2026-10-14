import { siteConfig } from "@/core/config/site";
import { BookingContract, BookingValidationError } from "@/domains/booking/services/BookingContract";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import type { SessionMode, StudentBookingRequest } from "../types";

const MODES: readonly SessionMode[] = ["online", "in_person"];

/** Validation for a signed-in student's session booking. Pure: shared by the form and the API route. */
export class StudentBookingContract {
  static readonly OTHER = "Other";
  static readonly LIMITS = { topic: [3, 120], address: [5, 200], notes: 500 } as const;

  static parse(body: unknown, courses: readonly string[], now: Date = new Date()): StudentBookingRequest {
    if (!body || typeof body !== "object") throw new BookingValidationError("body must be a JSON object");
    const b = body as Record<string, unknown>;
    const text = (key: string) => (typeof b[key] === "string" ? (b[key] as string).trim().replace(/[ \t]+/g, " ") : "");
    const { LIMITS, OTHER } = StudentBookingContract;

    const course = text("course");
    if (course !== OTHER && !courses.includes(course)) throw new BookingValidationError("Pick one of your courses, or Other.");

    const topic = course === OTHER ? text("topic") : "";
    if (course === OTHER && (topic.length < LIMITS.topic[0] || topic.length > LIMITS.topic[1])) {
      throw new BookingValidationError(`Tell us what the session should cover (${LIMITS.topic[0]}–${LIMITS.topic[1]} characters).`);
    }

    const mode = text("mode") as SessionMode;
    if (!MODES.includes(mode)) throw new BookingValidationError("Choose online or in person.");

    const address = mode === "in_person" ? text("address") : "";
    if (mode === "in_person" && (address.length < LIMITS.address[0] || address.length > LIMITS.address[1])) {
      throw new BookingValidationError("Add the address in Abu Dhabi where the session should take place.");
    }

    const notes = text("notes");
    if (notes.length > LIMITS.notes) throw new BookingValidationError(`Notes can be at most ${LIMITS.notes} characters.`);

    const minutes = b.minutes === undefined ? siteConfig.studentBooking.minutes : Number(b.minutes);
    if (!StudentBookingContract.isLength(minutes)) throw new BookingValidationError("Choose a session of 1 to 4 hours.");

    if (!ZonedCalendar.isValidTimeZone(b.timeZone)) throw new BookingValidationError("timeZone must be a valid IANA zone");

    const start = typeof b.start === "string" ? new Date(b.start) : new Date(Number.NaN);
    if (Number.isNaN(start.getTime())) throw new BookingValidationError("start must be an ISO datetime");
    if (start.getTime() <= now.getTime()) throw new BookingValidationError("start must be in the future");
    if (start.getTime() - now.getTime() > BookingContract.MAX_ADVANCE_DAYS * 86_400_000) {
      throw new BookingValidationError(`start must be within ${BookingContract.MAX_ADVANCE_DAYS} days`);
    }

    return { start: start.toISOString(), timeZone: b.timeZone, course, topic, mode, address, notes, minutes };
  }

  static isLength(minutes: unknown): minutes is number {
    return typeof minutes === "number" && (siteConfig.studentBooking.lengths as readonly number[]).includes(minutes);
  }

  /** A new start for an existing booking: ISO, in the future, within the booking window. */
  static parseStart(value: unknown, now: Date = new Date()): string {
    const start = typeof value === "string" ? new Date(value) : new Date(Number.NaN);
    if (Number.isNaN(start.getTime()) || start.getTime() <= now.getTime()) throw new BookingValidationError("Pick a time in the future.");
    if (start.getTime() - now.getTime() > BookingContract.MAX_ADVANCE_DAYS * 86_400_000) {
      throw new BookingValidationError(`Pick a time within ${BookingContract.MAX_ADVANCE_DAYS} days.`);
    }
    return start.toISOString();
  }

  /**
   * How many back-to-back hourly slots start at `index` (capped at `max`):
   * a run of k free 60-minute slots means a k-hour session fits there.
   */
  static runLength(slots: readonly { start: string }[], index: number, max: number): number {
    let length = index >= 0 && index < slots.length ? 1 : 0;
    while (length > 0 && length < max && index + length < slots.length) {
      if (Date.parse(slots[index + length].start) - Date.parse(slots[index + length - 1].start) !== 3_600_000) break;
      length++;
    }
    return length;
  }

  /** The text Cal.com shows the owner in the booking and its emails. */
  static summary(request: StudentBookingRequest): string {
    return [
      `Course: ${request.course === StudentBookingContract.OTHER ? `Other: ${request.topic}` : request.course}`,
      `Length: ${request.minutes / 60} h`,
      `Where: ${request.mode === "online" ? "Online (Google Meet)" : `In person: ${request.address}`}`,
      request.notes && `Notes: ${request.notes}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
}
