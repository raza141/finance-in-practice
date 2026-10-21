import type { NextRequest } from "next/server";

import { siteConfig } from "@/core/config/site";
import { EmailHtml } from "@/core/email/EmailHtml";
import { ResendClient } from "@/core/email/ResendClient";
import { RequestGuard } from "@/core/http/RequestGuard";
import { GoogleOAuth } from "@/domains/admin/server/GoogleOAuth";
import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";
import { EmailLink, type EmailLinkKind } from "@/domains/students/server/EmailLink";
import { StudentRepository } from "@/domains/students/server/StudentRepository";
import { RegistrationContract } from "@/domains/students/services/RegistrationContract";

const NO_STORE = { "Cache-Control": "no-store" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 5 emails per client IP per hour (per warm instance): this route mails a typed address.
const limiter = new SlidingWindowRateLimiter(5, 60 * 60_000);

function reject(status: number, message: string) {
  return Response.json({ message }, { status, headers: NO_STORE });
}

/** The same answer whether or not we mailed anyone, so the form can't tell who is a student. */
const sent = () => Response.json({ ok: true }, { headers: NO_STORE });

const COPY: Record<Exclude<EmailLinkKind, "unsubscribe">, { subject: string; heading: string; line: string; button: string }> = {
  register: {
    subject: "Confirm your email to open your student portal",
    heading: "Confirm your email",
    line: "Open the link below to confirm this is your email. Your student portal opens straight away.",
    button: "Confirm and open my portal",
  },
  signin: {
    subject: "Your sign-in link for the student portal",
    heading: "Sign in to your student portal",
    line: "Open the link below to sign in.",
    button: "Sign in",
  },
};

/** True once the email is handed to Resend. Outside production the link is logged instead, so testing never mails real people. */
async function mail(to: string, name: string, kind: keyof typeof COPY, url: string): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[email-link] ${kind} link for ${to}: ${url}`);
    return true;
  }
  const resend = ResendClient.fromEnv();
  if (!resend) return false;
  const copy = COPY[kind];
  const first = name.split(/\s+/)[0];
  const minutes = EmailLink.TTL_MS / 60_000;
  const note = `The link works for ${minutes} minutes. If you didn't ask for it, ignore this email.`;
  try {
    await resend.send(to, {
      subject: copy.subject,
      html: EmailHtml.document(
        copy.heading,
        EmailHtml.paragraph(`Hi ${first},`) + EmailHtml.paragraph(copy.line) + EmailHtml.button(url, copy.button) + EmailHtml.paragraph(note),
      ),
      text: `Hi ${first},\n\n${copy.line}\n\n${url}\n\n${note}\n\n${siteConfig.name}`,
    });
    return true;
  } catch (error) {
    console.error("[email-link] email failed", error);
    return false;
  }
}

/**
 * POST /api/student/email-link
 *   { intent: "register", name, email, phone, course, topic? }  parks the
 *     registration and mails a link that enrols and signs in (no Google needed).
 *   { intent: "signin", email }  mails a sign-in link if that email is a student.
 * Nothing is enrolled and no session starts until the emailed link is opened.
 */
export async function POST(request: NextRequest) {
  if (!RequestGuard.isSameOrigin(request)) return reject(403, "Cross-origin requests are not allowed.");
  if (!limiter.allow(RequestGuard.clientIp(request))) return reject(429, "Too many requests. Please try again later.");

  const repo = StudentRepository.fromEnv();
  const links = EmailLink.fromEnv();
  const classrooms = ClassroomRepository.fromEnv();
  if (!repo || !links || !classrooms) return reject(503, "This is not available right now. Please message us on WhatsApp.");

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return reject(400, "Invalid request.");
  }
  if (typeof body.website === "string" && body.website !== "") return sent();
  const origin = GoogleOAuth.canonicalOrigin(request.nextUrl.origin);

  try {
    if (body.intent === "register") {
      const { titles, batches, packages, groups } = await classrooms.registrationOptions();
      const parsed = RegistrationContract.parse(body, titles, batches, packages, groups);
      if (!parsed.ok) return reject(400, parsed.error);
      const id = await repo.park(parsed.value);
      // Every registration is mailed, so saying the send failed reveals nothing about who is a student.
      if (!(await mail(parsed.value.email, parsed.value.name, "register", links.url(origin, "register", id)))) {
        return reject(502, "We couldn't send the email. Please try again, or use Register with Google.");
      }
      return sent();
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > RegistrationContract.LIMITS.email || !EMAIL.test(email)) return reject(400, "Add a valid email address.");
    const student = await repo.enrolledByEmail(email);
    if (student) await mail(student.email, student.name, "signin", links.url(origin, "signin", student.id));
    return sent();
  } catch (error) {
    console.error("[email-link] failed", error);
    return reject(500, "Something went wrong. Please retry shortly.");
  }
}
