import type { NextRequest } from "next/server";

import { BookingGateway } from "@/domains/booking/server/BookingGateway";
import { CalComClient } from "@/domains/booking/server/CalComClient";
import { BookingContract } from "@/domains/booking/services/BookingContract";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/booking/slots?date=YYYY-MM-DD&timeZone=Area/City
 *   -> { date, timeZone, slots: [{ start, end }] }       (UTC ISO instants)
 * GET /api/booking/slots?start=YYYY-MM-DD&end=YYYY-MM-DD&timeZone=Area/City
 *   -> { start, end, timeZone, days: [{ date, slots }] }  (every date present)
 *
 * Dates are calendar days in `timeZone`; times are always returned in UTC.
 */
export async function GET(request: NextRequest) {
  const cal = CalComClient.fromEnv();
  if (!cal) {
    return Response.json(
      { error: "NOT_CONFIGURED", message: "Online booking is not configured." },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    const query = BookingContract.parseSlotsQuery(request.nextUrl.searchParams);
    const gateway = new BookingGateway(cal);
    const body =
      query.kind === "day"
        ? await gateway.day(query.date, query.timeZone)
        : await gateway.range(query.start, query.end, query.timeZone);
    return Response.json(body, { headers: NO_STORE });
  } catch (error) {
    const { status, body } = BookingGateway.errorResponse(error);
    return Response.json(body, { status, headers: NO_STORE });
  }
}
