import "server-only";

import { siteConfig } from "@/core/config/site";
import { EmailHtml, type EmailMessage } from "@/core/email/EmailHtml";
import { ResendClient } from "@/core/email/ResendClient";
import { LeadRepository } from "@/domains/resources/server/LeadRepository";

import { QuestionTaxonomy } from "../services/QuestionTaxonomy";
import type { Question } from "../types";
import { QuestionRepository } from "./QuestionRepository";

export type DailyEmailResult = { sent: number } | { skipped: string };

/**
 * The daily question email. It links to the question rather than carrying it:
 * email clients can't render the maths, and the answer is on the site.
 * Runs from /api/cron/cfa-question; does nothing until the owner switches emails on.
 */
export class QuestionEmails {
  /** leads.resource_id of daily-question subscribers. */
  static readonly LIST = "cfa-qotd";
  private static readonly BATCH = 100;

  static async run(): Promise<DailyEmailResult> {
    const questions = QuestionRepository.fromEnv();
    const leads = LeadRepository.fromEnv();
    if (!questions || !leads) return { skipped: "no database" };
    const { pagesOn, emailsOn } = await questions.switches();
    if (!pagesOn || !emailsOn) return { skipped: "switched off" };
    const resend = ResendClient.fromEnv();
    if (!resend) return { skipped: "Resend not configured" };

    const q = await questions.claimForEmail();
    if (!q) return { skipped: "no new question in the last 24 hours" };
    const subscribers = await leads.subscribers(QuestionEmails.LIST);
    let sent = 0;
    for (let i = 0; i < subscribers.length; i += QuestionEmails.BATCH) {
      // ponytail: Resend allows ~2 requests/s; one batch of 100 per second fits ~5,000 readers in the 60 s cron budget.
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
      const batch = subscribers.slice(i, i + QuestionEmails.BATCH);
      try {
        await resend.sendBatch(batch.map((s) => ({ to: s.email, message: QuestionEmails.build(q, `${siteConfig.url}/cfa/unsubscribe?id=${s.id}`) })));
        sent += batch.length;
      } catch (error) {
        console.error("[cfa-question] batch failed", error);
      }
    }
    return { sent };
  }

  static build(q: Question, unsubscribeUrl: string): EmailMessage {
    const url = `${siteConfig.url}${QuestionTaxonomy.path(q)}?utm_source=email&utm_medium=daily-question`;
    const meta = [QuestionTaxonomy.levelLabel(q.level), QuestionTaxonomy.topic(q.topic)?.name ?? q.topic, QuestionTaxonomy.difficultyLabel(q.difficulty)].join(" · ");
    const subject = `CFA question of the day: ${q.title}`;
    const body =
      `<p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;color:#64748b;text-transform:uppercase">${EmailHtml.escape(meta)}</p>` +
      `<p style="margin:0 0 16px;font-size:20px;font-weight:700">${EmailHtml.escape(q.title)}</p>` +
      EmailHtml.paragraph("Today's question is up. Pick your answer, then open the full worked solution.") +
      EmailHtml.button(url, "Answer today's question") +
      `<p style="margin:0;font-size:12px;color:#64748b">You signed up for the daily CFA question. ${EmailHtml.link(unsubscribeUrl, "Unsubscribe")}.</p>`;
    return {
      subject,
      html: EmailHtml.document(subject, body),
      text: `${meta}\n${q.title}\n\nAnswer today's question: ${url}\n\nUnsubscribe: ${unsubscribeUrl}`,
    };
  }
}
