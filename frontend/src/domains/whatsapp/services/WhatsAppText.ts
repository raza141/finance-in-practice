import { siteConfig } from "@/core/config/site";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";

import type { ClassPostKind } from "../types";

const HOUR = 3_600_000;

/** Who a message is from, for the {sender} and {business} sign-off. */
export interface Signature {
  sender: string;
  business: string;
}

/** A booking's reminder: when it may go out and when it is no longer worth sending. */
export interface ReminderPlan {
  key: "r1";
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
  /** The portal's "Exams & mocks" tab. */
  static readonly PORTAL_MOCKS = `${WhatsAppText.PORTAL}?tab=plan`;

  /** Cal.com's own page for one booking: reschedule or cancel without signing in. */
  static manageLink(uid: string): string {
    return `https://cal.com/booking/${encodeURIComponent(uid)}`;
  }

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
   * The hour-before reminder, only when the booking was made at least 3 hours ahead. No day-before
   * one: the owner sends anything in between by hand.
   */
  static reminders(start: Date, createdAt: Date): ReminderPlan[] {
    const lead = start.getTime() - createdAt.getTime();
    const plans: ReminderPlan[] = [];
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

  private static readonly WORDS = SettingsContract.DEFAULTS.whatsapp;

  static readonly fill = SettingsContract.fillMessage;

  private static session(
    name: string,
    title: string,
    start: Date,
    timeZone: string,
    where: string | null,
    link: string,
    sign: Signature,
  ): Record<string, string> {
    return { firstName: WhatsAppText.first(name), session: title, when: WhatsAppText.when(start, timeZone), where: where ?? "", link, ...sign };
  }

  static bookingConfirmed(
    name: string,
    title: string,
    start: Date,
    timeZone: string,
    where: string | null,
    link: string,
    sign: Signature,
    template = WhatsAppText.WORDS.booking,
  ): string {
    return WhatsAppText.fill(template, WhatsAppText.session(name, title, start, timeZone, where, link, sign));
  }

  /** A portal request the owner declined; `reason` is theirs, sent as written. */
  static requestDeclined(name: string, start: Date, timeZone: string, reason: string, sign: Signature, template = WhatsAppText.WORDS.declined): string {
    return WhatsAppText.fill(template, { firstName: WhatsAppText.first(name), when: WhatsAppText.when(start, timeZone), reason, link: WhatsAppText.PORTAL, ...sign });
  }

  static reminder(
    name: string,
    title: string,
    start: Date,
    timeZone: string,
    where: string | null,
    link: string,
    sign: Signature,
    template = WhatsAppText.WORDS.reminder,
  ): string {
    return WhatsAppText.fill(template, { ...WhatsAppText.session(name, title, start, timeZone, where, link, sign), lead: "in about an hour" });
  }

  static overdue(name: string, number: string, balance: string, dueDate: string, link: string, sign: Signature, template = WhatsAppText.WORDS.overdue): string {
    return WhatsAppText.fill(template, { firstName: WhatsAppText.first(name), number, balance, dueDate: InvoiceEmails.day(dueDate), link, ...sign });
  }

  /** A mock, or a whole product ("all mock exams"), given to a student; `from` when access starts later. */
  static mockGiven(name: string, mock: string, from: Date | null, sign: Signature, template = WhatsAppText.WORDS.mock): string {
    const later = from && from.getTime() > Date.now() + HOUR;
    const day = later ? new Intl.DateTimeFormat("en-GB", { timeZone: WhatsAppText.ZONE, weekday: "short", day: "numeric", month: "short" }).format(from) : "";
    return WhatsAppText.fill(template, { firstName: WhatsAppText.first(name), mock, from: later ? ` from ${day}` : "", link: WhatsAppText.PORTAL_MOCKS, ...sign });
  }

  static readonly KIND_LABEL: Record<ClassPostKind, string> = {
    mock: "mock exam",
    assignment: "assignment",
    material: "material",
    announcement: "announcement",
  };

  /** The class-post message, with {firstName} left for each student (`personal`). */
  static classPost(
    kind: ClassPostKind,
    classTitle: string,
    title: string,
    due: Date | null,
    link: string | null,
    sign: Signature,
    template = WhatsAppText.WORDS.class,
  ): string {
    return WhatsAppText.fill(template, {
      kind: WhatsAppText.KIND_LABEL[kind],
      class: classTitle,
      title,
      due: due ? `Due: ${WhatsAppText.when(due, WhatsAppText.ZONE)}` : "",
      link: link ?? WhatsAppText.PORTAL,
      ...sign,
    });
  }

  static nudge(title: string, due: Date | null, link: string | null, sign: Signature): string {
    return [
      "Hi {firstName},",
      `A reminder: *${title}* ${due ? `is due ${WhatsAppText.when(due, WhatsAppText.ZONE)}` : "is waiting"} and isn't handed in yet.`,
      `Open it here: ${link ?? WhatsAppText.PORTAL}`,
      WhatsAppText.signOff(sign),
    ].join("\n\n");
  }

  static signOff(sign: Signature): string {
    return `Thank you,\n${sign.sender}\n${sign.business}`;
  }

  /** Ready-made beginnings for the owner's own message; {firstName} is filled per student. */
  static starters(sign: Signature): { label: string; text: string }[] {
    const letter = (...lines: string[]) => ["Hi {firstName},", ...lines, WhatsAppText.signOff(sign)].join("\n\n");
    return [
      { label: "Blank", text: letter("") },
      { label: "Session update", text: letter("A quick update about your session:", `You can see and change your sessions here: ${WhatsAppText.PORTAL}`) },
      { label: "Payment reminder", text: letter("A friendly reminder about your payment for this month.", "If you have already paid, thank you, and please ignore this message.") },
      { label: "New mock", text: letter("A new mock exam is ready for you on your study portal.", `Open it here: ${WhatsAppText.PORTAL_MOCKS}`) },
      { label: "Class update", text: letter("An update about your class:", `Your portal: ${WhatsAppText.PORTAL}`) },
    ];
  }

  /** Fills {firstName} (and the older {name}) with the student's first name. */
  static personal(template: string, name: string): string {
    const first = WhatsAppText.first(name);
    return template.replaceAll("{firstName}", first).replaceAll("{name}", first);
  }

  /** STOP / START replies, as WhatsApp users type them. */
  static command(text: string): "stop" | "start" | null {
    const word = text.trim().toUpperCase().replace(/[.!]+$/, "");
    if (["STOP", "UNSUBSCRIBE"].includes(word)) return "stop";
    if (word === "START") return "start";
    return null;
  }
}
