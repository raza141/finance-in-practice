import type { NextRequest } from "next/server";

import { RequestGuard } from "@/core/http/RequestGuard";

import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";
import {
  TestimonialContract,
  TestimonialValidationError,
  type TestimonialErrorCode,
} from "@/domains/testimonials/services/TestimonialContract";

const NO_STORE = { "Cache-Control": "no-store" };

// 3 submissions per client IP per hour (per warm instance).
const limiter = new SlidingWindowRateLimiter(3, 60 * 60_000);

function reject(status: number, error: TestimonialErrorCode, message: string) {
  return Response.json({ error, message }, { status, headers: NO_STORE });
}

/**
 * POST /api/testimonials
 *   body: { author, email, context, program, quote, outcome?, consent, website? }
 *   201 -> { id, status: "pending" }
 * New testimonials stay hidden until approved in /admin/testimonials.
 */
export async function POST(request: NextRequest) {
  if (!RequestGuard.isSameOrigin(request)) return reject(403, "FORBIDDEN", "Cross-origin requests are not allowed.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter.allow(ip)) {
    return reject(429, "RATE_LIMITED", "Too many submissions. Please try again later.");
  }

  const repo = TestimonialRepository.fromEnv();
  if (!repo) return reject(503, "NOT_CONFIGURED", "Testimonial submissions are not available right now.");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return reject(400, "INVALID_REQUEST", "Body must be valid JSON.");
  }

  try {
    const submission = TestimonialContract.parseSubmission(payload);
    if (submission.website) {
      // Honeypot filled: store nothing. Not a fake success, so a human whose
      // browser autofilled the field isn't misled.
      return reject(400, "INVALID_REQUEST", "Unable to process this request.");
    }
    const created = await repo.create(submission, new Date());
    return Response.json(created, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof TestimonialValidationError) {
      return reject(400, "INVALID_REQUEST", error.message);
    }
    console.error("[testimonials] submission failed", error);
    return reject(500, "UPSTREAM_ERROR", "Something went wrong. Please retry shortly.");
  }
}
