import "server-only";

import { ApiError } from "@/core/http/ApiError";
import { CalComClient, type CalBookingDetail } from "@/domains/booking/server/CalComClient";
import { BookingCatalog } from "@/domains/booking/services/BookingCatalog";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import { InvoiceContract } from "../services/InvoiceContract";
import type { BookingPrefill } from "../types";

export interface PrefillResult {
  prefill: BookingPrefill | null;
  /** Shown above the (blank) form when a requested booking couldn't be loaded. */
  error: string | null;
}

/** Reads a Cal.com booking (`?booking=<uid>`) to prefill the invoice and confirmation forms. */
export class BookingPrefillLoader {
  static async load(uid: string | string[] | undefined): Promise<PrefillResult> {
    if (uid === undefined) return { prefill: null, error: null };
    if (!InvoiceContract.isBookingUid(uid)) return { prefill: null, error: "That booking reference is not valid." };
    const cal = CalComClient.fromEnv();
    if (!cal) return { prefill: null, error: "Cal.com is not configured, so the booking can't be loaded. Fill the form in by hand." };
    try {
      return { prefill: BookingPrefillLoader.toPrefill(await cal.booking(uid)), error: null };
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return { prefill: null, error: `Couldn't load booking ${uid} from Cal.com (${error.message}). Fill the form in by hand.` };
    }
  }

  static toPrefill(booking: CalBookingDetail): BookingPrefill {
    const attendee = booking.attendees?.[0];
    const timeZone = ZonedCalendar.isValidTimeZone(attendee?.timeZone) ? attendee.timeZone : InvoiceContract.DEFAULT_TIME_ZONE;
    const calendar = new ZonedCalendar(timeZone);
    const start = new Date(booking.start);
    const track = new BookingCatalog().tracks().find((t) => t.id === booking.metadata?.track);
    return {
      bookingUid: booking.uid,
      clientName: attendee?.name ?? "",
      clientEmail: attendee?.email ?? "",
      clientTimeZone: timeZone,
      date: calendar.dateOf(start),
      time: calendar.timeOf(start),
      durationMinutes: Math.round((Date.parse(booking.end) - start.getTime()) / 60_000) || 60,
      topic: track?.title ?? booking.title ?? "",
      location: booking.meetingUrl ?? "",
    };
  }
}
