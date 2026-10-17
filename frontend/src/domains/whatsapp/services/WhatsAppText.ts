import { siteConfig } from "@/core/config/site";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";

import type { ClassPostKind } from "../types";

const HOUR = 3_600_000;

/** A booking's reminder: when it may go out and when it is no longer worth sending. */
export interface ReminderPlan {
  key: "r24" | "r1";
  notBefore: Date;
  expiresAt: Date;
  /** The 1-hour reminder may go out in quiet hours (an 08:30 session). */
  quietOk: boolean;
}

/**
 * What the WhatsApp messages say, and the timing rules around them. Pure:
 * the server decides who and when, this decides the words.
 */
export class WhatsAppText {
  static readonly ZONE = InvoiceContract.DEFAULT_TIME_ZONE;
  /** No messages 22:00–08:00 Dubai time, except those marked quietOk. */
  static readonly QUIET_FROM = 22;
  static readonly QUIET_UNTIL = 8;
  static readonly PORTAL = `${siteConfig.url}/student`;

  /** "+971 50 230 4045" / "050 230 4045" -> "971502304045"; empty when unusable. */
  static phone(raw: string): string {
    const digits = InvoiceEmails.whatsappNumber(raw);
    return /^[0-9]{8,15}$/.test(digits) ? digits : "";
  }

  static isQuiet(now: Date): boolean {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: WhatsAppText.ZONE, hour: "2-digit", hourCycle: "h23" }).format(now));
    return hour >= WhatsAppText.QUIET_FROM || hour < WhatsAppText.QUIET_UNTIL;
  }

  /**
   * Day-before and hour-before reminders. A reminder is only planned when the
   * booking was made well before it (booked 3 hours ahead: no day-before one).
   */
  static reminders(start: Date, createdAt: Date): ReminderPlan[] {
    const lead = start.getTime() - createdAt.getTime();
    const plans: ReminderPlan[] = [];
    if (lead >= 26 * HOUR) plans.push({ key: "r24", notBefore: new Date(start.getTime() - 24 * HOUR), expiresAt: new Date(start.getTime() - 2 * HOUR), quietOk: false });
    if (lead >= 3 * HOUR) plans.push({ key: "r1", notBefore: new Date(start.getTime() - HOUR), expiresAt: start, quietOk: true });
    return plans;
  }

  /** Overdue reminder is due: an open invoice this many days past its due date. */
  static readonly OVERDUE_DAYS = 5;

  static isOverdue(dueDate: string, today: string): boolean {
    return ZonedCalendar.daysBetween(dueDate, today) >= WhatsAppText.OVERDUE_DAYS;
  }

  private static first(name: string): string {
    return InvoiceEmails.firstName(name) || "there";
  }

  /** "Tue 21 Oct, 19:00 (GMT+4)" in the student's zone. */
  static when(start: Date, timeZone: string): string {
    const zone = ZonedCalendar.isValidTimeZone(timeZone) ? timeZone : WhatsAppText.ZONE;
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    }).format(start);
  }

  static intro(name: string, sender: string): string {
    return [
      `Hi ${WhatsAppText.first(name)}, this is ${sender} from ${siteConfig.name}.`,
      "I'll send your session confirmations, reminders, invoices and class updates on this number. Please save it.",
      "Reply STOP at any time to stop these messages.",
    ].join("\n\n");
  }

  static newNumber(name: string, sender: string): string {
    return [
      `Hi ${WhatsAppText.first(name)}, ${siteConfig.name} has a new WhatsApp number: this one. Please save it; the old number is no longer used.`,
      `${sender}`,
      "Reply STOP to stop these messages.",
    ].join("\n\n");
  }

  static bookingConfirmed(name: string, title: string, start: Date, timeZone: string, where: string | null): string {
    return [
      `Hi ${WhatsAppText.first(name)}, your session is confirmed ✅`,
      `${title}\n${WhatsAppText.when(start, timeZone)}${where ? `\n${where}` : ""}`,
      "To reschedule, reply here or use the link in your Cal.com email.",
    ].join("\n\n");
  }

  static reminder(key: ReminderPlan["key"], name: string, title: string, start: Date, timeZone: string, where: string | null): string {
    const lead = key === "r24" ? "tomorrow" : "in about an hour";
    return [`Hi ${WhatsAppText.first(name)}, a reminder: your session is ${lead}.`, `${title}\n${WhatsAppText.when(start, timeZone)}${where ? `\n${where}` : ""}`].join(
      "\n\n",
    );
  }

  static overdue(name: string, number: string, balance: string, dueDate: string, link: string, sender: string): string {
    return [
      `Hi ${WhatsAppText.first(name)}, a gentle reminder that invoice ${number} (${balance}) was due on ${InvoiceEmails.day(dueDate)}.`,
      `You can view it here: ${link}`,
      "If you've already paid, thank you, and please ignore this message.",
      sender,
    ].join("\n\n");
  }

  static readonly KIND_LABEL: Record<ClassPostKind, string> = {
    mock: "mock exam",
    assignment: "assignment",
    material: "material",
    announcement: "announcement",
  };

  /** The class-post message; `{name}` is replaced per student when sent from the button. */
  static classPost(kind: ClassPostKind, classTitle: string, title: string, due: Date | null, link: string | null): string {
    const head = kind === "announcement" ? `New announcement in ${classTitle}:` : `New ${WhatsAppText.KIND_LABEL[kind]} in ${classTitle}:`;
    return [
      `Hi {name}, ${head}\n*${title}*${due ? `\nDue: ${WhatsAppText.when(due, WhatsAppText.ZONE)}` : ""}`,
      [link ? `Open it in Google Classroom: ${link}` : "", `Your portal: ${WhatsAppText.PORTAL}`].filter(Boolean).join("\n"),
    ].join("\n\n");
  }

  static nudge(title: string, due: Date | null, link: string | null): string {
    return [
      `Hi {name}, a reminder: *${title}* ${due ? `is due ${WhatsAppText.when(due, WhatsAppText.ZONE)}` : "is waiting"} and isn't handed in yet.`,
      link ? `Open it in Google Classroom: ${link}` : `Your portal: ${WhatsAppText.PORTAL}`,
    ].join("\n\n");
  }

  /** Fills the `{name}` placeholder with the student's first name. */
  static personal(template: string, name: string): string {
    return template.replaceAll("{name}", WhatsAppText.first(name));
  }

  /** STOP / START replies, as WhatsApp users type them. */
  static command(text: string): "stop" | "start" | null {
    const word = text.trim().toUpperCase().replace(/[.!]+$/, "");
    if (["STOP", "UNSUBSCRIBE"].includes(word)) return "stop";
    if (word === "START") return "start";
    return null;
  }
}
