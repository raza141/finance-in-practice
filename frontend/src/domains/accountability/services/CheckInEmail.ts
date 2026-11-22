import { EmailHtml, type EmailMessage } from "@/core/email/EmailHtml";
import { siteConfig } from "@/core/config/site";

import { OnTrack } from "./OnTrack";
import { StreakEngine } from "./StreakEngine";
import { StudyFormat as F } from "./StudyFormat";
import type { StudentProgress } from "./StudyProgress";

export interface CheckInDraft {
  subject: string;
  body: string;
}

/** The weekly check-in: their figures and one action, drafted for the tutor to edit. Never blames, never sends itself. */
export class CheckInEmail {
  static readonly LIMITS = { subject: 150, body: 3000 } as const;

  static action({ streak, onTrack, plan, weakest }: StudentProgress): string {
    const { earnBack } = streak;
    if (earnBack)
      return `${F.count(earnBack.questionsLeft, "question")} or ${F.count(earnBack.minutesLeft, "minute")} by ${F.day(earnBack.until)} brings your ${streak.current}-day streak back.`;
    if (streak.missedRun > 0 && !streak.qualifiedToday) return `${StreakEngine.BAR.questions} questions today is enough to get going again.`;
    if (onTrack && onTrack.coverageRatio < OnTrack.GREEN_NEEDS.coverage) return "Do a short set from a chapter you haven't practised yet.";
    if (onTrack && onTrack.hoursRatio < 1 && plan.perDay !== null) return `Plan ${F.toDo(plan.perDay)} on each study day this week.`;
    if (weakest.length) return `Do a 20-question drill on ${weakest[0].name}.`;
    return "Keep the same rhythm this week.";
  }

  static draft(p: StudentProgress): CheckInDraft {
    const stats = [
      p.onTrack && `On-Track score: ${p.onTrack.score} of 100`,
      `Hours: ${F.hours(p.plan.hoursDone)} of ${p.goal.targetHours} h`,
      `Streak: ${F.count(p.streak.current, "day")}`,
      p.accuracy !== null && `Accuracy, last 14 days: ${F.percent(p.accuracy)}`,
      p.plan.daysLeft !== null && p.plan.daysLeft >= 0 && `Days to your exam: ${p.plan.daysLeft}`,
    ].filter(Boolean);
    return {
      subject: `Your ${p.goal.course} week`,
      body: `Hi ${p.goal.name.split(" ")[0]},\n\nHere's where you are:\n${stats.join("\n")}\n\nOne thing for this week: ${CheckInEmail.action(p)}\n\nReply if you'd like to talk it through.`,
    };
  }

  static parse(form: FormData): { ok: true; value: CheckInDraft } | { ok: false; error: string } {
    const subject = String(form.get("subject") ?? "").replace(/[\r\n]+/g, " ").trim();
    const body = String(form.get("body") ?? "").replace(/\r\n/g, "\n").trim();
    if (!subject || subject.length > CheckInEmail.LIMITS.subject) return { ok: false, error: "The subject must be 1 to 150 characters." };
    if (!body || body.length > CheckInEmail.LIMITS.body) return { ok: false, error: "The message must be 1 to 3,000 characters." };
    return { ok: true, value: { subject, body } };
  }

  static message({ subject, body }: CheckInDraft): EmailMessage {
    const url = `${siteConfig.url}/student?tab=plan`;
    const html = body
      .split(/\n{2,}/)
      .map(EmailHtml.paragraph)
      .join("");
    return { subject, html: EmailHtml.document(subject, html + EmailHtml.button(url, "Open your study plan")), text: `${body}\n\n${url}` };
  }
}
