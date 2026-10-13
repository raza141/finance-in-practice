import type { NextRequest } from "next/server";

import { siteConfig } from "@/core/config/site";
import { BookingGateway } from "@/domains/booking/server/BookingGateway";
import { CalComClient } from "@/domains/booking/server/CalComClient";
import { BookingContract, BookingValidationError } from "@/domains/booking/services/BookingContract";
import { BlockRepository } from "@/domains/schedule/server/BlockRepository";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/student/slots?start=YYYY-MM-DD&end=YYYY-MM-DD&timeZone=Area/City
 *   Signed-in students only: free times of the students' session event.
 */
export async function GET(request: NextRequest) {
  if (!(await StudentAuth.current())) {
    return Response.json({ error: "FORBIDDEN", message: "Please sign in again." }, { status: 401, headers: NO_STORE });
  }
  const cal = CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug);
  if (!cal) {
    return Response.json({ error: "NOT_CONFIGURED", message: "Online booking is not configured." }, { status: 503, headers: NO_STORE });
  }
  try {
    const query = BookingContract.parseSlotsQuery(request.nextUrl.searchParams);
    if (query.kind !== "range") throw new BookingValidationError("provide start and end as YYYY-MM-DD");
    const body = await new BookingGateway(cal, BlockRepository.fromEnv()).range(query.start, query.end, query.timeZone);
    return Response.json(body, { headers: NO_STORE });
  } catch (error) {
    const { status, body } = BookingGateway.errorResponse(error);
    return Response.json(body, { status, headers: NO_STORE });
  }
}
