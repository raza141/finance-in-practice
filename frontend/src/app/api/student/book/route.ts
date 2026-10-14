import type { NextRequest } from "next/server";

import { siteConfig } from "@/core/config/site";
import { RequestGuard } from "@/core/http/RequestGuard";
import { BookingGateway } from "@/domains/booking/server/BookingGateway";
import { CalComClient } from "@/domains/booking/server/CalComClient";
import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { BlockRepository } from "@/domains/schedule/server/BlockRepository";
import { StudentAuth } from "@/domains/students/server/StudentAuth";
import { StudentRepository } from "@/domains/students/server/StudentRepository";
import { StudentBookingContract } from "@/domains/students/services/StudentBookingContract";

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
    const courses = (await StudentRepository.fromEnv()?.bookableCourses(student)) ?? student.courses;
    const booking = StudentBookingContract.parse(payload, courses);
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
    return Response.json(result, { status: 200, headers: NO_STORE });
  } catch (error) {
    const { status, body } = BookingGateway.errorResponse(error);
    return Response.json(body, { status, headers: NO_STORE });
  }
}
