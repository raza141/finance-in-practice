import type { NextRequest } from "next/server";

import { RequestGuard } from "@/core/http/RequestGuard";
import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { QuestionEmails } from "@/domains/questions/server/QuestionEmails";
import { QuestionRepository } from "@/domains/questions/server/QuestionRepository";
import { LeadRepository } from "@/domains/resources/server/LeadRepository";

const NO_STORE = { "Cache-Control": "no-store" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// 5 sign-ups per client IP per hour (per warm instance).
const limiter = new SlidingWindowRateLimiter(5, 60 * 60_000);

function reject(status: number, message: string) {
  return Response.json({ message }, { status, headers: NO_STORE });
}

/**
 * POST /api/cfa/subscribe  body: { email, website? }
 * Saves the reader as a lead for the daily question (leads.resource_id = "cfa-qotd").
 */
export async function POST(request: NextRequest) {
  if (!RequestGuard.isSameOrigin(request)) return reject(403, "Cross-origin requests are not allowed.");
  if (!limiter.allow(RequestGuard.clientIp(request))) return reject(429, "Too many requests. Please try again later.");

  const body = (await request.json().catch(() => null)) as { email?: unknown; website?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return reject(400, "Enter a valid email address.");
  if (typeof body?.website === "string" && body.website) return reject(400, "Unable to process this request.");

  const leads = LeadRepository.fromEnv();
  const questions = QuestionRepository.fromEnv();
  if (!leads || !questions) return reject(503, "Sign-ups are not available right now.");
  try {
    if (!(await questions.switches()).pagesOn) return reject(404, "Not found.");
    await leads.save({ email, resourceId: QuestionEmails.LIST, source: "cfa-question", marketingOptIn: true });
  } catch (error) {
    console.error("[cfa-subscribe] could not save", error);
    return reject(500, "Something went wrong. Please retry shortly.");
  }
  return Response.json({ ok: true }, { headers: NO_STORE });
}
