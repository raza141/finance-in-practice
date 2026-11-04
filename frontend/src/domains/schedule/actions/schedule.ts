"use server";

import { refresh, updateTag } from "next/cache";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { AdminInbox } from "@/domains/admin/server/AdminInbox";
import { siteConfig } from "@/core/config/site";
import { BookingGateway } from "@/domains/booking/server/BookingGateway";
import { CalComClient } from "@/domains/booking/server/CalComClient";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { RequestNotice } from "@/domains/students/server/RequestNotice";
import { WhatsAppText } from "@/domains/whatsapp/services/WhatsAppText";
import { SessionLogRepository } from "@/domains/students/server/SessionLogRepository";
import { RequestOverlapError, SessionRequestRepository } from "@/domains/students/server/SessionRequestRepository";
import { SessionLogContract } from "@/domains/students/services/SessionLogContract";
import { StudentBookingContract } from "@/domains/students/services/StudentBookingContract";

import { BlockRepository } from "../server/BlockRepository";
import { BlockContract } from "../services/BlockContract";
import { Schedule } from "../services/Schedule";

/** Schedule management. Server actions are public POST endpoints: each re-checks the session. */

export type ScheduleActionState = { ok: boolean; message: string } | null;

function blocks(): BlockRepository {
  const repo = BlockRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

export async function blockTime(_prev: ScheduleActionState, form: FormData): Promise<ScheduleActionState> {
  const admin = await AdminAuth.require();
  const input = BlockContract.parse(form);
  if (!input.ok) return input;
  const clientId = String(form.get("clientId") ?? "");
  if (clientId) return bookFor(clientId, input.range, form);
  await blocks().create(input.range, input.reason, admin.id);
  refresh();
  return { ok: true, message: "Blocked. Those slots are hidden from the website now." };
}

/**
 * The owner books a student session from the Block time form: the same Cal.com "session" booking the
 * portal makes (same emails, counts in the student's portal and hours), confirmed at once. Unlike the
 * portal it may cover time the owner blocked here, and skips the student's limits (terms, upcoming cap,
 * hours left). Cal.com still refuses times outside working hours or over a calendar event.
 */
async function bookFor(clientId: string, range: { start: string; end: string }, form: FormData): Promise<ScheduleActionState> {
  const client = await ClientRepository.fromEnv()?.byId(clientId);
  if (!client?.email) return { ok: false, message: "That student has no email. Add one on their client page first." };
  const minutes = (Date.parse(range.end) - Date.parse(range.start)) / 60_000;
  if (!StudentBookingContract.isLength(minutes)) return { ok: false, message: "A session is 1, 2 or 3 hours: set From and To to match." };
  if (Date.parse(range.start) <= Date.now()) return { ok: false, message: "Pick a time in the future." };
  const inPerson = form.get("mode") === "in_person";
  const address = String(form.get("address") ?? "").trim().slice(0, 200);
  if (inPerson && address.length < 5) return { ok: false, message: "Add the address for the in-person session." };
  const course = String(form.get("course") ?? "").trim().slice(0, 120) || "Session";
  const cal = CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug);
  if (!cal) return { ok: false, message: "Cal.com is not configured." };
  try {
    const booking = await new BookingGateway(cal, null).book(
      {
        start: range.start,
        attendee: { name: client.name, email: client.email, timeZone: Schedule.TIME_ZONE, language: "en" },
        location: inPerson ? { type: "attendeeAddress", address } : { type: "integration", integration: "zoom" },
        bookingFieldsResponses: {
          notes: [`Course: ${course}`, `Length: ${minutes / 60} h`, `Where: ${inPerson ? `In person: ${address}` : "Online (Zoom)"}`, "Booked by your instructor"].join("\n"),
        },
        lengthInMinutes: minutes,
        metadata: { source: "financeinpractice.me/admin", clientId: client.id, course },
      },
      minutes,
    );
    if (booking.status.toLowerCase() === "pending") await cal.confirmBooking(booking.uid);
  } catch (error) {
    console.error("[schedule] booking for a student failed", error);
    const detail = error instanceof Error ? error.message : "";
    return { ok: false, message: `Cal.com refused this time${detail ? `: ${detail}` : ""}. It may be outside your working hours or clash with your calendar.` };
  }
  done();
  return { ok: true, message: `Booked for ${client.name}. Cal.com has emailed them the confirmation${inPerson ? "" : " and the Zoom link"}.` };
}

export async function removeBlock(id: string): Promise<void> {
  await AdminAuth.require();
  await blocks().remove(id);
  refresh();
}

/** Cal.com emails the client and removes the event from the connected calendars. */
export async function cancelBooking(uid: string, reason: string): Promise<ScheduleActionState> {
  const requestId = SessionRequestRepository.idOf(uid);
  if (requestId) return declineRequest(requestId, reason);
  const cal = await bookingClient(uid);
  if (!(cal instanceof CalComClient)) return cal;
  try {
    await cal.cancelBooking(uid, reason.trim().slice(0, 300) || "Cancelled by host");
  } catch (error) {
    console.error("[schedule] cancel failed", error);
    return { ok: false, message: "Cal.com refused the cancellation. Try again or cancel from Cal.com." };
  }
  done();
  return { ok: true, message: "Booking cancelled. Cal.com has emailed the client." };
}

/** Accepts a booking waiting for confirmation. */
export async function confirmBooking(uid: string): Promise<ScheduleActionState> {
  const requestId = SessionRequestRepository.idOf(uid);
  if (requestId) return approveRequest(requestId);
  const cal = await bookingClient(uid);
  if (!(cal instanceof CalComClient)) return cal;
  try {
    await cal.confirmBooking(uid);
  } catch (error) {
    console.error("[schedule] confirm failed", error);
    return { ok: false, message: "Cal.com refused the confirmation. Try again or confirm from Cal.com." };
  }
  done();
  return { ok: true, message: "Confirmed. Cal.com has emailed the client and added it to your calendar." };
}

/** Rejects a booking waiting for confirmation; the reason goes to the client. */
export async function declineBooking(uid: string, reason: string): Promise<ScheduleActionState> {
  const requestId = SessionRequestRepository.idOf(uid);
  if (requestId) return declineRequest(requestId, reason);
  const cal = await bookingClient(uid);
  if (!(cal instanceof CalComClient)) return cal;
  try {
    await cal.declineBooking(uid, reason.trim().slice(0, 300) || "This time isn't available. Please pick another.");
  } catch (error) {
    console.error("[schedule] decline failed", error);
    return { ok: false, message: "Cal.com refused. Try again or decline from Cal.com." };
  }
  done();
  return { ok: true, message: "Declined. Cal.com has emailed the client." };
}

/**
 * Moves any booking to a new Dubai date and time; Cal.com emails both sides. `minutes` also changes a
 * student session's length (1, 2 or 3 h); null keeps the booked length.
 */
export async function moveBooking(uid: string, date: string, time: string, minutes: number | null = null): Promise<ScheduleActionState> {
  const cal = await bookingClient(uid);
  if (!(cal instanceof CalComClient)) return cal;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Schedule.TIME.test(time)) return { ok: false, message: "Pick a date and a time." };
  if (minutes !== null && !StudentBookingContract.isLength(minutes)) return { ok: false, message: "Pick a length of 1, 2 or 3 hours." };
  const start = Schedule.instant(date, time);
  if (Number.isNaN(Date.parse(start)) || Date.parse(start) <= Date.now()) return { ok: false, message: "Pick a time in the future." };
  const requestId = SessionRequestRepository.idOf(uid);
  if (requestId) {
    // Not confirmed yet, so nobody is told: approving it sends the confirmation at the new time.
    try {
      if (!(await requests().move(requestId, start, minutes))) return { ok: false, message: "That request was already decided." };
    } catch (error) {
      if (error instanceof RequestOverlapError) return { ok: false, message: "Another request is waiting for that time." };
      throw error;
    }
    done();
    return { ok: true, message: "Moved. Still waiting: approve it to send the confirmation." };
  }
  const admin = await AdminAuth.require();
  try {
    await cal.rescheduleBooking(uid, start, admin.email, "Rescheduled by Finance in Practice", minutes ?? undefined);
  } catch (error) {
    console.error("[schedule] reschedule failed", error);
    const detail = error instanceof Error ? error.message : "";
    return { ok: false, message: `Cal.com refused the new time${detail ? `: ${detail}` : ""}. It may be outside your working hours or already taken.` };
  }
  done();
  return { ok: true, message: `Moved. Cal.com has emailed the client the new time${minutes ? " and length" : ""}.` };
}

/** The admin is signed in and the uid looks like a Cal.com booking. */
/**
 * The time a past session actually took (booked 1 h, studied 3), or `null` to go
 * back to the booked length. Only our own record changes: Cal.com, the client's
 * calendar and WhatsApp are never told. Owner only.
 */
export async function setStudied(uid: string, hours: string | null): Promise<ScheduleActionState> {
  await AdminAuth.requireOwner();
  const cal = await bookingClient(uid);
  if (!(cal instanceof CalComClient)) return cal;
  const logs = SessionLogRepository.fromEnv();
  const clients = ClientRepository.fromEnv();
  if (!logs || !clients) return { ok: false, message: "The database is not configured." };
  let booking;
  try {
    booking = await cal.booking(uid);
  } catch (error) {
    console.error("[schedule] booking lookup failed", error);
    return { ok: false, message: "Couldn't read that booking from Cal.com. Try again." };
  }
  if (booking.status !== "accepted" || Date.parse(booking.end) > Date.now()) return { ok: false, message: "Only sessions that already took place can be corrected." };
  // Booked from the portal: its client id; otherwise the attendee's email.
  const fromMeta = booking.metadata?.clientId ? await clients.byId(booking.metadata.clientId) : null;
  const client = fromMeta ?? (booking.attendees[0]?.email ? await clients.byEmail(booking.attendees[0].email) : null);
  if (!client) return { ok: false, message: "Add them as a client first (Clients → New), then set the hours." };
  if (hours === null) {
    await logs.removeBooking(client.id, uid);
  } else {
    const parsed = SessionLogContract.parse({ hours, bookingUid: uid }, new ZonedCalendar(Schedule.TIME_ZONE).today());
    if (!parsed.ok) return { ok: false, message: parsed.error };
    await logs.save(client.id, parsed.value);
  }
  refresh();
  return { ok: true, message: hours === null ? "Back to the booked length." : `Saved for ${client.name}: their Hours & payments counts this now.` };
}

async function bookingClient(uid: string): Promise<CalComClient | Exclude<ScheduleActionState, null>> {
  await AdminAuth.require();
  const cal = CalComClient.fromEnv();
  if (!cal) return { ok: false, message: "Cal.com is not configured." };
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(uid)) return { ok: false, message: "Unknown booking." };
  return cal;
}

/** When the confirmed session a declined move leaves in place starts, in the student's zone; null if unreadable. */
async function keptTime(uid: string, timeZone: string): Promise<string | null> {
  try {
    const booking = await CalComClient.fromEnv()?.booking(uid);
    return booking && booking.status === "accepted" ? WhatsAppText.when(new Date(booking.start), timeZone) : null;
  } catch (error) {
    console.error("[schedule] kept session lookup failed", uid, error);
    return null;
  }
}

function requests(): SessionRequestRepository {
  const repo = SessionRequestRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

/**
 * Books a waiting portal request on Cal.com, which emails both sides the one confirmation (and the
 * WhatsApp scan sends its own). Admin blocks don't apply: the owner is the one approving.
 */
async function approveRequest(id: string): Promise<ScheduleActionState> {
  await AdminAuth.require();
  const cal = CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug);
  if (!cal) return { ok: false, message: "Cal.com is not configured." };
  const repo = requests();
  const r = await repo.open(id);
  if (!r) return { ok: false, message: "That request was already decided, or its time has passed." };
  const minutes = Math.round((Date.parse(r.end) - Date.parse(r.start)) / 60_000);
  let bookingUid: string;
  if (r.rescheduleOf) {
    // A move of a confirmed session: Cal.com moves it and emails both sides the new time (one email).
    try {
      const admin = await AdminAuth.require();
      bookingUid = (await cal.rescheduleBooking(r.rescheduleOf, r.start, admin.email, "Rescheduled at the student's request", minutes)).uid;
    } catch (error) {
      console.error("[schedule] approving move failed", id, error);
      const detail = error instanceof Error ? error.message : "";
      return { ok: false, message: `Cal.com refused the move${detail ? `: ${detail}` : ""}. The session may have been cancelled, or the time clashes: decline the request.` };
    }
    if (!(await repo.decide(id, "approved", { bookingUid }))) console.error("[schedule] move done but not marked approved", id, bookingUid);
    done();
    return { ok: true, message: `Moved. Cal.com has emailed ${r.name} the new time.` };
  }
  try {
    const booking = await new BookingGateway(cal, null).book(
      {
        start: r.start,
        attendee: { name: r.name, email: r.email, timeZone: r.timeZone, language: "en" },
        location: r.mode === "online" ? { type: "integration", integration: "zoom" } : { type: "attendeeAddress", address: r.address },
        // The owner may have changed the length since the student asked.
        bookingFieldsResponses: { notes: r.summary.replace(/^Length: .*$/m, `Length: ${minutes / 60} h`) },
        lengthInMinutes: minutes,
        metadata: { source: "financeinpractice.me/student", clientId: r.clientId, course: r.course },
      },
      minutes,
    );
    // While "Requires confirmation" is still on for the session event, Cal.com holds it as pending: confirm at once.
    if (booking.status.toLowerCase() === "pending") await cal.confirmBooking(booking.uid);
    bookingUid = booking.uid;
  } catch (error) {
    console.error("[schedule] approving request failed", id, error);
    const detail = error instanceof Error ? error.message : "";
    return { ok: false, message: `Cal.com refused this time${detail ? `: ${detail}` : ""}. It may clash with your calendar: move or decline the request.` };
  }
  // Booked: a failure here leaves the request showing, and approving again is refused by Cal.com (the time is taken).
  if (!(await repo.decide(id, "approved", { bookingUid }))) console.error("[schedule] request booked but not marked approved", id, bookingUid);
  done();
  return { ok: true, message: `Approved. Cal.com has emailed ${r.name} the confirmation${r.mode === "online" ? " and the Zoom link" : ""}.` };
}

/** Closes a waiting request; the student gets one email and one WhatsApp message with the reason. */
async function declineRequest(id: string, reason: string): Promise<ScheduleActionState> {
  await AdminAuth.require();
  const repo = requests();
  const r = await repo.open(id);
  if (!r) return { ok: false, message: "That request was already decided, or its time has passed." };
  const given = reason.trim().slice(0, 300) || "This time isn't available. Please pick another.";
  if (!(await repo.decide(id, "declined", { reason: given }))) return { ok: false, message: "That request was already decided." };
  // A declined move leaves the confirmed session where it was: say so.
  const kept = r.rescheduleOf ? await keptTime(r.rescheduleOf, r.timeZone) : null;
  const sent = await RequestNotice.declined(r, kept ? `${given}\n\nYour session on ${kept} stays booked.` : given);
  done();
  const told = [sent.email && "emailed", sent.whatsapp && "sent a WhatsApp to"].filter(Boolean).join(" and ");
  return { ok: true, message: told ? `Declined. We've ${told} ${r.name}.` : `Declined, but no email or WhatsApp could be sent to ${r.name}: let them know yourself.` };
}

function done(): void {
  updateTag(AdminInbox.BOOKINGS_TAG);
  refresh();
}
