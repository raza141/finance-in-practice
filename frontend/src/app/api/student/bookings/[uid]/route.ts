import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { siteConfig } from "@/core/config/site";
import { RequestGuard } from "@/core/http/RequestGuard";
import { AdminInbox } from "@/domains/admin/server/AdminInbox";
import { BookingGateway } from "@/domains/booking/server/BookingGateway";
import { CalComClient, type CalBookingDetail } from "@/domains/booking/server/CalComClient";
import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { BlockRepository } from "@/domains/schedule/server/BlockRepository";
import { StudentAuth } from "@/domains/students/server/StudentAuth";
import { StudentBookingContract } from "@/domains/students/services/StudentBookingContract";
import type { Student } from "@/domains/students/types";

const NO_STORE = { "Cache-Control": "no-store" };
const UID = /^[A-Za-z0-9_-]{6,64}$/;

// 10 changes per IP per 10 minutes (per warm instance).
const limiter = new SlidingWindowRateLimiter(10, 10 * 60_000);

function reject(status: number, error: string, message: string) {
  return Response.json({ error, message }, { status, headers: NO_STORE });
}

/** The signed-in student, Cal.com and the booking — only when the booking is theirs and still open. */
async function ownBooking(request: NextRequest, uid: string): Promise<Response | { student: Student; cal: CalComClient; booking: CalBookingDetail }> {
  if (!RequestGuard.isSameOrigin(request)) return reject(403, "FORBIDDEN", "Cross-origin requests are not allowed.");
  if (!limiter.allow(RequestGuard.clientIp(request))) return reject(429, "RATE_LIMITED", "Too many changes. Please wait a few minutes.");
  const student = await StudentAuth.current();
  if (!student) return reject(401, "FORBIDDEN", "Please sign in again.");
  const cal = CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug);
  if (!cal) return reject(503, "NOT_CONFIGURED", "Online booking is not configured.");
  if (!UID.test(uid)) return reject(404, "NOT_FOUND", "We couldn't find that session.");

  let booking: CalBookingDetail;
  try {
    booking = await cal.booking(uid);
  } catch {
    return reject(404, "NOT_FOUND", "We couldn't find that session.");
  }
  const email = student.email.toLowerCase();
  const isTheirs = booking.attendees.some((a) => a.email.toLowerCase() === email);
  if (!isTheirs || !["accepted", "pending"].includes(booking.status) || Date.parse(booking.start) <= Date.now()) {
    return reject(404, "NOT_FOUND", "That session can't be changed any more.");
  }
  // A group class or mock: one student cancelling would cancel it for everyone.
  if (booking.attendees.length > 1) return reject(409, "GROUP_SESSION", "This is a group session. Please message your instructor to change it.");
  return { student, cal, booking };
}

/**
 * POST /api/student/bookings/:uid
 *   { action: "reschedule", start } -> moves the session, same length
 *   { action: "cancel" }            -> cancels it
 * Only the student booked on it may change it; Cal.com emails both sides.
 */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/student/bookings/[uid]">) {
  const own = await ownBooking(request, (await params).uid);
  if (own instanceof Response) return own;
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; start?: unknown };
  try {
    if (body.action === "cancel") {
      await own.cal.cancelBooking(own.booking.uid, "Cancelled by the student on financeinpractice.me");
      revalidateTag(AdminInbox.BOOKINGS_TAG, { expire: 0 });
      return Response.json({ uid: own.booking.uid, status: "cancelled" }, { headers: NO_STORE });
    }
    if (body.action !== "reschedule") return reject(400, "INVALID_REQUEST", "action must be reschedule or cancel");
    const start = StudentBookingContract.parseStart(body.start);
    const minutes = Math.round((Date.parse(own.booking.end) - Date.parse(own.booking.start)) / 60_000);
    const result = await new BookingGateway(own.cal, BlockRepository.fromEnv()).reschedule(own.booking.uid, start, minutes, own.student.email);
    revalidateTag(AdminInbox.BOOKINGS_TAG, { expire: 0 });
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    const { status, body: payload } = BookingGateway.errorResponse(error);
    return Response.json(payload, { status, headers: NO_STORE });
  }
}
