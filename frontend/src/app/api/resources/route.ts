import type { NextRequest } from "next/server";

import { siteConfig } from "@/core/config/site";
import { EmailHtml } from "@/core/email/EmailHtml";
import { ResendClient } from "@/core/email/ResendClient";
import { RequestGuard } from "@/core/http/RequestGuard";
import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { LeadRepository } from "@/domains/resources/server/LeadRepository";
import { LeadContract, LeadValidationError, type LeadRequest } from "@/domains/resources/services/LeadContract";

const NO_STORE = { "Cache-Control": "no-store" };

// 5 requests per client IP per hour (per warm instance).
const limiter = new SlidingWindowRateLimiter(5, 60 * 60_000);

function reject(status: number, message: string) {
  return Response.json({ message }, { status, headers: NO_STORE });
}

/** Best-effort copy by email; the download already happened on the page, so a failure here is only logged. */
async function emailCopy(lead: LeadRequest, url: string): Promise<boolean> {
  const resend = ResendClient.fromEnv();
  if (!resend) return false;
  const title = lead.resource.title.replace("®", "");
  const body =
    EmailHtml.paragraph(`Here is your copy of the ${title}.`) +
    EmailHtml.button(url, `Download the ${title}`) +
    EmailHtml.paragraph("Want the plan built around your exam date? Book a free 30-minute diagnostic session, in person in Abu Dhabi or live online.") +
    EmailHtml.button(`${siteConfig.url}/#book`, "Book a free diagnostic session");
  try {
    await resend.send(lead.email, {
      subject: `Your ${title}`,
      html: EmailHtml.document(title, body),
      text: `Your ${title}: ${url}\n\nBook a free diagnostic session: ${siteConfig.url}/#book`,
    });
    return true;
  } catch (error) {
    console.error("[resources] email copy failed", error);
    return false;
  }
}

/**
 * POST /api/resources
 *   body: { email, resource, source?, marketingOptIn?, website? }
 *   200 -> { url, emailed } (the page shows a download link; a copy goes by email when Resend is set up)
 */
export async function POST(request: NextRequest) {
  if (!RequestGuard.isSameOrigin(request)) return reject(403, "Cross-origin requests are not allowed.");
  if (!limiter.allow(RequestGuard.clientIp(request))) return reject(429, "Too many requests. Please try again later.");

  let lead: LeadRequest;
  try {
    lead = LeadContract.parse(await request.json());
  } catch (error) {
    return reject(400, error instanceof LeadValidationError ? error.message : "Invalid request.");
  }
  if (lead.website) return reject(400, "Unable to process this request.");

  const repo = LeadRepository.fromEnv();
  if (!repo) return reject(503, "Downloads are not available right now.");
  try {
    await repo.save({ email: lead.email, resourceId: lead.resource.id, source: lead.source, marketingOptIn: lead.marketingOptIn });
  } catch (error) {
    console.error("[resources] could not save lead", error);
    return reject(500, "Something went wrong. Please retry shortly.");
  }

  const url = `${siteConfig.url}${lead.resource.file}`;
  const emailed = await emailCopy(lead, url);
  return Response.json({ url: lead.resource.file, emailed }, { headers: NO_STORE });
}
