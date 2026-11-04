import "server-only";

import { siteConfig } from "@/core/config/site";
import { EmailHtml } from "@/core/email/EmailHtml";
import { ResendClient } from "@/core/email/ResendClient";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { Schedule } from "@/domains/schedule/services/Schedule";
import { WhatsAppOutbox } from "@/domains/whatsapp/server/WhatsAppOutbox";
import { WhatsAppText } from "@/domains/whatsapp/services/WhatsAppText";

import { OwnerNotice } from "./OwnerNotice";
import type { SessionRequest } from "./SessionRequestRepository";

/**
 * Tells a student their session request was declined: the only message a request ever sends,
 * since an approved one is announced by Cal.com (email) and the WhatsApp scan. Never throws.
 */
export class RequestNotice {
  /** The owner's heads-up for a new request or a move (`from`: the confirmed time it would replace). Never throws. */
  static async toOwner(name: string, clientId: string, start: string, minutes: number, summary: string, from: string | null = null): Promise<void> {
    const dubai = new ZonedCalendar(Schedule.TIME_ZONE);
    const at = (iso: string) => `${dubai.dateOf(new Date(iso))} ${dubai.timeOf(new Date(iso))}`;
    const details = summary.split("\n").map((line): [string, string] => {
      const colon = line.indexOf(":");
      return colon < 0 ? ["Note", line] : [line.slice(0, colon), line.slice(colon + 1).trim()];
    });
    await OwnerNotice.send(
      `${from ? "Move request" : "Session request"}: ${name}, ${at(start)}`,
      from ? "A student wants to move a session" : "A session is waiting for your approval",
      [["Student", name], ...(from ? [["Booked now (Dubai)", at(from)] as [string, string]] : []), [from ? "Wants (Dubai)" : "When (Dubai)", `${at(start)}, ${minutes / 60} h`], ...details.filter(([k]) => k && k !== "Length")],
      clientId,
      { path: `/admin/schedule?week=${Schedule.weekStart(dubai.dateOf(new Date(start)))}`, label: "Approve or decline" },
    );
  }

  static async declined(request: SessionRequest, reason: string): Promise<{ email: boolean; whatsapp: boolean }> {
    const start = new Date(request.start);
    const [email, whatsapp] = await Promise.all([
      RequestNotice.email(request, start, reason),
      WhatsAppOutbox.fromEnv()?.requestDeclined(request.clientId, request.id, start, request.timeZone, reason) ?? false,
    ]);
    return { email, whatsapp };
  }

  private static async email(request: SessionRequest, start: Date, reason: string): Promise<boolean> {
    const resend = ResendClient.fromEnv();
    if (!resend || !request.email) return false;
    const when = WhatsAppText.when(start, request.timeZone);
    const portal = `${siteConfig.url}${siteConfig.studentBooking.href}`;
    const first = request.name.trim().split(/\s+/)[0] || request.name;
    try {
      await resend.send(request.email, {
        subject: `Your session request for ${when} couldn't be confirmed`,
        html: EmailHtml.document(
          "Session request declined",
          EmailHtml.paragraph(`Hi ${first},`) +
            EmailHtml.paragraph(`Sorry, your session request for ${when} (${request.course}) couldn't be confirmed.`) +
            EmailHtml.paragraph(reason) +
            EmailHtml.paragraph("Please pick another time on your portal.") +
            EmailHtml.button(portal, "Pick another time"),
          { follow: true },
        ),
        text: `Hi ${first},\n\nSorry, your session request for ${when} (${request.course}) couldn't be confirmed.\n\n${reason}\n\nPlease pick another time on your portal: ${portal}`,
      });
      return true;
    } catch (error) {
      console.error("[session-request] decline email failed", request.id, error);
      return false;
    }
  }
}
