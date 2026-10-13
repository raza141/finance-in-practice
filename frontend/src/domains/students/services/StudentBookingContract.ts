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

    if (!ZonedCalendar.isValidTimeZone(b.timeZone)) throw new BookingValidationError("timeZone must be a valid IANA zone");

    const start = typeof b.start === "string" ? new Date(b.start) : new Date(Number.NaN);
    if (Number.isNaN(start.getTime())) throw new BookingValidationError("start must be an ISO datetime");
    if (start.getTime() <= now.getTime()) throw new BookingValidationError("start must be in the future");
    if (start.getTime() - now.getTime() > BookingContract.MAX_ADVANCE_DAYS * 86_400_000) {
      throw new BookingValidationError(`start must be within ${BookingContract.MAX_ADVANCE_DAYS} days`);
    }

    return { start: start.toISOString(), timeZone: b.timeZone, course, topic, mode, address, notes };
  }

  /** The text Cal.com shows the owner in the booking and its emails. */
  static summary(request: StudentBookingRequest): string {
    return [
      `Course: ${request.course === StudentBookingContract.OTHER ? `Other: ${request.topic}` : request.course}`,
      `Where: ${request.mode === "online" ? "Online (Google Meet)" : `In person: ${request.address}`}`,
      request.notes && `Notes: ${request.notes}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
}
