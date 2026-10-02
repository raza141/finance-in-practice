import "server-only";

import { ApiError } from "@/core/http/ApiError";

import {
  BookingValidationError,
  type BookingErrorBody,
  type BookingErrorCode,
  type CreateBookingRequest,
  type CreateBookingResponse,
  type DaySlotsResponse,
  type RangeSlotsResponse,
  type SlotWire,
} from "../services/BookingContract";
import { ZonedCalendar } from "../services/ZonedCalendar";
import { CalComClient, type CalSlot } from "./CalComClient";

/** Maps between Cal.com's API and our booking contract. */
export class BookingGateway {
  constructor(private readonly cal: CalComClient) {}

  async day(date: string, timeZone: string): Promise<DaySlotsResponse> {
    const data = await this.cal.slots(date, date, timeZone);
    return { date, timeZone, slots: BookingGateway.toWire(data[date] ?? []) };
  }

  /** Every date in [start, end] is present, with an empty list when unavailable. */
  async range(start: string, end: string, timeZone: string): Promise<RangeSlotsResponse> {
    const data = await this.cal.slots(start, end, timeZone);
    const span = ZonedCalendar.daysBetween(start, end);
    const days = Array.from({ length: span + 1 }, (_, i) => {
      const date = ZonedCalendar.addDays(start, i);
      return { date, slots: BookingGateway.toWire(data[date] ?? []) };
    });
    return { start, end, timeZone, days };
  }

  async create(request: CreateBookingRequest): Promise<CreateBookingResponse> {
    const booking = await this.cal.createBooking({
      start: request.start,
      attendee: {
        name: request.name,
        email: request.email,
        timeZone: request.timeZone,
        language: "en",
      },
      metadata: { track: request.track, source: "financeinpractice.me" },
    });
    return { uid: booking.uid, start: booking.start, end: booking.end, status: booking.status };
  }

  /** Normalise Cal.com offsets ("…+04:00") to UTC ISO instants, sorted. */
  static toWire(slots: CalSlot[]): SlotWire[] {
    return slots
      .map((s) => ({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString() }))
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  /** Translate any failure into an HTTP status and a safe, client-facing body. */
  static errorResponse(error: unknown): { status: number; body: BookingErrorBody } {
    const respond = (status: number, code: BookingErrorCode, message: string) => ({
      status,
      body: { error: code, message },
    });

    if (error instanceof BookingValidationError) {
      return respond(400, "INVALID_REQUEST", error.message);
    }
    if (error instanceof ApiError) {
      if (error.kind === "validation" || error.status === 409) {
        // Cal.com rejects taken, past or out-of-hours slots with 400. Log the
        // upstream reason so misconfigurations (e.g. a new required field) are visible.
        console.warn("[booking] Cal.com rejected request:", error.message);
        return respond(409, "SLOT_UNAVAILABLE", "That slot is no longer available. Please pick another time.");
      }
      if (error.kind === "rate_limited") {
        return respond(503, "UPSTREAM_ERROR", "The scheduling service is busy. Please retry shortly.");
      }
      console.error("[booking] Cal.com request failed", error.kind, error.status, error.message);
      return respond(502, "UPSTREAM_ERROR", "The scheduling service is unavailable. Please retry shortly.");
    }
    console.error("[booking] unexpected error", error);
    return respond(500, "UPSTREAM_ERROR", "Something went wrong. Please retry shortly.");
  }
}
