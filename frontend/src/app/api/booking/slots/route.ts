import type { NextRequest } from "next/server";

import { BookingGateway } from "@/domains/booking/server/BookingGateway";
import { CalComClient } from "@/domains/booking/server/CalComClient";
import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { BlockRepository } from "@/domains/schedule/server/BlockRepository";
import { BookingContract } from "@/domains/booking/services/BookingContract";

const NO_STORE = { "Cache-Control": "no-store" };

// Each call reaches Cal.com: 60 per client IP per 10 minutes (per warm instance), far above a visitor browsing weeks.
const limiter = new SlidingWindowRateLimiter(60, 10 * 60_000);

/**
 * GET /api/booking/slots?date=YYYY-MM-DD&timeZone=Area/City
 *   -> { date, timeZone, slots: [{ start, end }] }       (UTC ISO instants)
 * GET /api/booking/slots?start=YYYY-MM-DD&end=YYYY-MM-DD&timeZone=Area/City
 *   -> { start, end, timeZone, days: [{ date, slots }] }  (every date present)
 *
 * Dates are calendar days in `timeZone`; times are always returned in UTC.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.allow(ip)) {
    return Response.json({ error: "RATE_LIMITED", message: "Too many requests. Please wait a few minutes." }, { status: 429, headers: NO_STORE });
  }
  const cal = CalComClient.fromEnv();
  if (!cal) {
    return Response.json(
      { error: "NOT_CONFIGURED", message: "Online booking is not configured." },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    const query = BookingContract.parseSlotsQuery(request.nextUrl.searchParams);
    const gateway = new BookingGateway(cal, BlockRepository.fromEnv());
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
