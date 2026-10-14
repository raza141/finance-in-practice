import type { NextRequest } from "next/server";

import { siteConfig } from "@/core/config/site";
import { EmailHtml } from "@/core/email/EmailHtml";
import { ResendClient } from "@/core/email/ResendClient";
import { RequestGuard } from "@/core/http/RequestGuard";
import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { RegistrationRepository } from "@/domains/students/server/RegistrationRepository";
import { RegistrationContract } from "@/domains/students/services/RegistrationContract";
import type { RegistrationInput } from "@/domains/students/types";

const NO_STORE = { "Cache-Control": "no-store" };
// Same answer whether or not the email is already a client: no account enumeration.
const THANKS = { message: "Thanks! We'll confirm your place by WhatsApp or email, usually within a day." };

// 5 sign-ups per client IP per hour (per warm instance).
const limiter = new SlidingWindowRateLimiter(5, 60 * 60_000);

function reject(status: number, message: string) {
  return Response.json({ message }, { status, headers: NO_STORE });
}

/** Best-effort heads-up to the owner's inbox (EMAIL_REPLY_TO); admin Clients lists every request regardless. */
async function notifyOwner(registration: RegistrationInput): Promise<void> {
  const to = process.env.EMAIL_REPLY_TO?.trim();
  const resend = ResendClient.fromEnv();
  if (!to || !resend) return;
  const rows: [string, string][] = [
    ["Name", registration.name],
    ["Email", registration.email],
    ["Mobile", registration.phone],
    ["Course", registration.course],
  ];
  try {
    await resend.send(to, {
      subject: `New student registration: ${registration.name}`,
      html: EmailHtml.document(
        "New student registration",
        EmailHtml.table(rows) + EmailHtml.button(`${siteConfig.url}/admin/clients#registrations`, "Review in admin"),
      ),
      text: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nReview: ${siteConfig.url}/admin/clients#registrations`,
    });
  } catch (error) {
    console.error("[register] owner email failed", error);
  }
}

/**
 * POST /api/student/register
 *   body: { name, email, phone, course, topic?, website? }
 *   Saves a request only; the owner approves it in admin before the student can sign in.
 */
export async function POST(request: NextRequest) {
  if (!RequestGuard.isSameOrigin(request)) return reject(403, "Cross-origin requests are not allowed.");
  if (!limiter.allow(RequestGuard.clientIp(request))) return reject(429, "Too many requests. Please try again later.");

  const repo = RegistrationRepository.fromEnv();
  const courses = CourseRepository.fromEnv();
  if (!repo || !courses) return reject(503, "Registration is not available right now. Please message us on WhatsApp.");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return reject(400, "Invalid request.");
  }

  try {
    const published = (await courses.active()).map((c) => c.title);
    const parsed = RegistrationContract.parse(payload, published);
    if (!parsed.ok) return reject(400, parsed.error);
    if (!parsed.spam) {
      await repo.create(parsed.value);
      await notifyOwner(parsed.value);
    }
    return Response.json(THANKS, { headers: NO_STORE });
  } catch (error) {
    console.error("[register] could not save", error);
    return reject(500, "Something went wrong. Please retry shortly.");
  }
}
