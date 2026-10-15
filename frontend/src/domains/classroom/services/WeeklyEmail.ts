import { EmailHtml, type EmailMessage } from "@/core/email/EmailHtml";
import { siteConfig } from "@/core/config/site";

import type { ClassItem } from "../types";
import type { ClassFeed } from "./ClassFeed";

type Week = ReturnType<typeof ClassFeed.week>;

const SHOW = 6;
const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }).format(new Date(iso));
const pct = (i: ClassItem) => (i.grade ? Math.round((i.grade.points / i.grade.max) * 1000) / 10 : 0);

/** "Your week in class": what's due, missing, new and marked. Pure; null when there's nothing to say. */
export class WeeklyEmail {
  static isEmpty(week: Week): boolean {
    return week.due.length + week.missing.length + week.fresh.length + week.marks.length === 0;
  }

  static build(name: string, week: Week, portalUrl: string, unsubscribeUrl: string): EmailMessage | null {
    if (WeeklyEmail.isEmpty(week)) return null;
    const first = name.split(/\s+/)[0] || "there";
    const sections: [string, ClassItem[], (i: ClassItem) => string][] = [
      ["Due this week", week.due, (i) => `Due ${when(i.dueAt!)}`],
      ["Missing", week.missing, () => "Past its due date"],
      ["Marks returned", week.marks, (i) => `${i.grade!.points}/${i.grade!.max} · ${pct(i)}%`],
      ["New in your class", week.fresh, (i) => `${i.kind === "announcement" ? "Announcement" : i.kind[0].toUpperCase() + i.kind.slice(1)} · ${i.classTitle}`],
    ];
    const used = sections.filter(([, items]) => items.length > 0);
    const counts = [week.due.length && `${week.due.length} due`, week.missing.length && `${week.missing.length} missing`, week.fresh.length && `${week.fresh.length} new`]
      .filter(Boolean)
      .join(" · ");
    const html =
      EmailHtml.paragraph(`Hi ${first}, here is your week in class.`) +
      used
        .map(
          ([title, items, detail]) =>
            `<p style="margin:20px 0 6px;font-weight:700">${EmailHtml.escape(title)}</p>` +
            EmailHtml.table(items.slice(0, SHOW).map((i) => [detail(i), i.title])) +
            (items.length > SHOW ? EmailHtml.paragraph(`and ${items.length - SHOW} more in your portal.`) : ""),
        )
        .join("") +
      EmailHtml.button(portalUrl, "Open my portal") +
      `<p style="margin:0;font-size:12px;color:#64748b">You get this on Sundays while you study with us. ${EmailHtml.link(unsubscribeUrl, "Stop these weekly emails")}.</p>`;
    const text = [
      `Hi ${first}, here is your week in class.`,
      ...used.map(([title, items, detail]) => `\n${title}\n${items.slice(0, SHOW).map((i) => `- ${i.title} (${detail(i)})`).join("\n")}`),
      `\nOpen your portal: ${portalUrl}`,
      `\nStop these weekly emails: ${unsubscribeUrl}`,
      `\n${EmailHtml.FOLLOW_TEXT}`,
    ].join("\n");
    return {
      subject: `Your week in class${counts ? `: ${counts}` : ""}`,
      html: EmailHtml.document("Your week in class", html, { follow: true }),
      text,
    };
  }

  static readonly ORIGIN = siteConfig.url;
  static readonly PORTAL = `${siteConfig.url}${siteConfig.studentBooking.href}`;
}
