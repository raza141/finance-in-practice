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
import { AgreementRepository } from "@/domains/invoices/server/AgreementRepository";
import { TermsRepository } from "@/domains/settings/server/TermsRepository";
import { HourRequestRepository } from "@/domains/students/server/HourRequestRepository";
import { SessionLogRepository } from "@/domains/students/server/SessionLogRepository";
import { StudentRepository } from "@/domains/students/server/StudentRepository";
import { Allowance } from "@/domains/students/services/Allowance";
import { StudentBookingContract } from "@/domains/students/services/StudentBookingContract";
import { StudentSessions } from "@/domains/students/services/StudentSessions";

const NO_STORE = { "Cache-Control": "no-store" };

// 10 booking attempts per IP per 10 minutes (per warm instance).
const limiter = new SlidingWindowRateLimiter(10, 10 * 60_000);

function reject(status: number, error: string, message: string) {
  return Response.json({ error, message }, { status, headers: NO_STORE });
}

/**
 * POST /api/student/book
 *   body: { start, timeZone, course, topic?, mode, address?, notes?, minutes? }
 *   Name and email come from the signed-in student's client record, never the body.
 *   200 -> { uid, start, end, status }  (status "pending" when the event needs confirmation)
 */
/** The booking's month allowance (monthly agreements with an hours limit), with the owner's corrections applied; null = no limit. */
async function allowanceFor(clientId: string, existing: CalBookingDetail[], start: string) {
  const [agreements, requests, log] = await Promise.all([
    AgreementRepository.fromEnv()?.forClient(clientId) ?? [],
    HourRequestRepository.fromEnv()?.forClient(clientId) ?? [],
    SessionLogRepository.fromEnv()?.forClient(clientId) ?? [],
  ]);
  return Allowance.forMonth({
    agreements,
    requests,
    bookings: StudentSessions.applyLog(existing, log),
    manual: log.flatMap((l) => (l.onDate ? [{ date: l.onDate, minutes: l.minutes }] : [])),
    month: Allowance.monthOf(start),
    freeSlug: process.env.NEXT_PUBLIC_CAL_LINK?.split("/")[1]?.trim(),
  });
}

export async function POST(request: NextRequest) {
  if (!RequestGuard.isSameOrigin(request)) return reject(403, "FORBIDDEN", "Cross-origin requests are not allowed.");
  if (!limiter.allow(RequestGuard.clientIp(request))) {
    return reject(429, "RATE_LIMITED", "Too many booking attempts. Please wait a few minutes.");
  }

  const student = await StudentAuth.current();
  if (!student) return reject(401, "FORBIDDEN", "Please sign in again.");

  const cal = CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug);
  if (!cal) return reject(503, "NOT_CONFIGURED", "Online booking is not configured.");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return reject(400, "INVALID_REQUEST", "Body must be valid JSON.");
  }

  try {
    const [courses, existing, termsAccepted] = await Promise.all([
      StudentRepository.fromEnv()?.bookableCourses(student) ?? student.courses,
      cal.bookingsFor(student.email),
      TermsRepository.fromEnv()?.acceptedCurrent(student.id) ?? true,
    ]);
    if (!termsAccepted) return reject(409, "TERMS_NOT_ACCEPTED", "Please accept the terms and conditions at the top of your portal, then book.");
    // A self-joined account can't hold the whole calendar: group classes the instructor added don't count.
    const { maxUpcoming } = siteConfig.studentBooking;
    if (StudentSessions.upcoming(existing).filter((s) => !s.group).length >= maxUpcoming) {
      return reject(409, "TOO_MANY_BOOKINGS", `You already have ${maxUpcoming} upcoming sessions. Book more after one of them, or message your instructor.`);
    }
    const booking = StudentBookingContract.parse(payload, courses);
    const allowance = await allowanceFor(student.id, existing, booking.start);
    if (allowance && allowance.leftMinutes < booking.minutes) {
      const left = Math.max(0, allowance.leftMinutes) / 60;
      return reject(
        409,
        "ALLOWANCE_USED",
        left > 0
          ? `Only ${Math.round(left * 100) / 100} h are left of this month's hours. Book a shorter session, or ask for more hours under Hours & payments.`
          : "You've used this month's hours. Ask for more hours under Hours & payments, and book once your instructor approves.",
      );
    }
    const result = await new BookingGateway(cal, BlockRepository.fromEnv()).book(
      {
        start: booking.start,
        attendee: { name: student.name, email: student.email, timeZone: booking.timeZone, language: "en" },
        location:
          booking.mode === "online"
            ? { type: "integration", integration: "google-meet" }
            : { type: "attendeeAddress", address: booking.address },
        bookingFieldsResponses: { notes: StudentBookingContract.summary(booking) },
        lengthInMinutes: booking.minutes,
        metadata: {
          source: "financeinpractice.me/student",
          clientId: student.id,
          course: (booking.course === StudentBookingContract.OTHER ? `Other: ${booking.topic}` : booking.course).slice(0, 500),
        },
      },
      booking.minutes,
    );
    revalidateTag(AdminInbox.BOOKINGS_TAG, { expire: 0 });
    return Response.json(result, { status: 200, headers: NO_STORE });
  } catch (error) {
    const { status, body } = BookingGateway.errorResponse(error);
    return Response.json(body, { status, headers: NO_STORE });
  }
}
