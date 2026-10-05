import type { NextRequest } from "next/server";

import { BookingGateway } from "@/domains/booking/server/BookingGateway";
import { CalComClient } from "@/domains/booking/server/CalComClient";
import { BlockRepository } from "@/domains/schedule/server/BlockRepository";
import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { BookingContract } from "@/domains/booking/services/BookingContract";

const NO_STORE = { "Cache-Control": "no-store" };

// 5 booking attempts per client IP per 10 minutes (per warm instance).
const limiter = new SlidingWindowRateLimiter(5, 10 * 60_000);

function reject(status: number, error: string, message: string) {
  return Response.json({ error, message }, { status, headers: NO_STORE });
}

/** Browsers always send Origin on cross-site POSTs; only our own pages may book. */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

/**
 * POST /api/booking/create
 *   body: { start, name, email, timeZone, track, company? }
 *   200 -> { uid, start, end, status }
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return reject(403, "FORBIDDEN", "Cross-origin requests are not allowed.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.allow(ip)) {
    return reject(429, "RATE_LIMITED", "Too many booking attempts. Please wait a few minutes.");
  }

  const cal = CalComClient.fromEnv();
  if (!cal) return reject(503, "NOT_CONFIGURED", "Online booking is not configured.");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return reject(400, "INVALID_REQUEST", "Body must be valid JSON.");
  }

  try {
    const booking = BookingContract.parseCreateRequest(payload);
    if (booking.company) {
      // Honeypot filled: never touch the real calendar. Deliberately not a fake
      // success, so a human whose browser autofilled the field isn't misled.
      return reject(400, "INVALID_REQUEST", "Unable to process this request.");
    }
    const result = await new BookingGateway(cal, BlockRepository.fromEnv()).create(booking);
    return Response.json(result, { status: 200, headers: NO_STORE });
  } catch (error) {
    const { status, body } = BookingGateway.errorResponse(error);
    return Response.json(body, { status, headers: NO_STORE });
  }
}
