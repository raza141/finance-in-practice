import "server-only";

import { siteConfig } from "@/core/config/site";
import { EmailHtml } from "@/core/email/EmailHtml";
import { ResendClient } from "@/core/email/ResendClient";

/** Best-effort heads-up to the owner's inbox (EMAIL_REPLY_TO) about a client. Never throws. */
export class OwnerNotice {
  static async send(subject: string, heading: string, rows: [string, string][], clientId: string): Promise<void> {
    const to = process.env.EMAIL_REPLY_TO?.trim();
    const resend = ResendClient.fromEnv();
    if (!to || !resend) return;
    const link = `${siteConfig.url}/admin/clients/${clientId}`;
    try {
      await resend.send(to, {
        subject: subject.replace(/[\r\n]+/g, " "),
        html: EmailHtml.document(heading, EmailHtml.table(rows) + EmailHtml.button(link, "Open in admin")),
        text: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${link}`,
      });
    } catch (error) {
      console.error("[owner-notice] email failed", error);
    }
  }
}
