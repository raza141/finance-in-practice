import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { siteConfig } from "@/core/config/site";
import { EmailHtml } from "@/core/email/EmailHtml";
import { ResendClient } from "@/core/email/ResendClient";
import { RequestGuard } from "@/core/http/RequestGuard";
import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { SignupTicket } from "@/domains/students/server/SignupTicket";
import { StudentAuth } from "@/domains/students/server/StudentAuth";
import { StudentRepository } from "@/domains/students/server/StudentRepository";
import { RegistrationContract } from "@/domains/students/services/RegistrationContract";
import type { RegistrationInput } from "@/domains/students/types";

const NO_STORE = { "Cache-Control": "no-store" };

// 5 joins per client IP per hour (per warm instance).
const limiter = new SlidingWindowRateLimiter(5, 60 * 60_000);

function reject(status: number, message: string) {
  return Response.json({ message }, { status, headers: NO_STORE });
}

/** Best-effort heads-up to the owner's inbox (EMAIL_REPLY_TO). */
async function notifyOwner(student: RegistrationInput, clientId: string): Promise<void> {
  const to = process.env.EMAIL_REPLY_TO?.trim();
  const resend = ResendClient.fromEnv();
  if (!to || !resend) return;
  const rows: [string, string][] = [
    ["Name", student.name],
    ["Email", student.email],
    ["Mobile", student.phone],
    ["Course", student.course],
  ];
  const link = `${siteConfig.url}/admin/clients/${clientId}`;
  try {
    await resend.send(to, {
      subject: `New student joined: ${student.name}`,
      html: EmailHtml.document("New student joined", EmailHtml.table(rows) + EmailHtml.button(link, "Open in admin")),
      text: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${link}`,
    });
  } catch (error) {
    console.error("[join] owner email failed", error);
  }
}

/**
 * POST /api/student/join  body: { name, phone, course, topic? }
 *   Needs the signed ticket the Google callback set: the email comes from
 *   Google, never the body. Enrols the student and signs them in.
 */
export async function POST(request: NextRequest) {
  if (!RequestGuard.isSameOrigin(request)) return reject(403, "Cross-origin requests are not allowed.");
  if (!limiter.allow(RequestGuard.clientIp(request))) return reject(429, "Too many requests. Please try again later.");

  const store = await cookies();
  const email = SignupTicket.fromEnv()?.read(store.get(SignupTicket.COOKIE)?.value);
  if (!email) return reject(401, "Your Google sign-in expired. Please continue with Google again.");

  const repo = StudentRepository.fromEnv();
  const courses = CourseRepository.fromEnv();
  if (!repo || !courses) return reject(503, "Joining is not available right now. Please message us on WhatsApp.");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return reject(400, "Invalid request.");
  }

  try {
    const published = (await courses.active()).map((c) => c.title);
    const parsed = RegistrationContract.parse({ ...(payload as object), email }, published);
    if (!parsed.ok) return reject(400, parsed.error);
    if (parsed.spam) return reject(400, "Unable to process this request.");
    const clientId = await repo.join(parsed.value);
    await StudentAuth.startSession(clientId, repo);
    store.delete({ name: SignupTicket.COOKIE, path: "/" });
    await notifyOwner(parsed.value, clientId);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    console.error("[join] could not enrol", error);
    return reject(500, "Something went wrong. Please retry shortly.");
  }
}
