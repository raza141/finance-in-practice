import { siteConfig } from "@/core/config/site";
import { EmailHtml, type EmailMessage } from "@/core/email/EmailHtml";

import type { BankDetails, ConfirmationInput, Invoice } from "../types";
import { InvoiceContract } from "./InvoiceContract";
import { InvoiceMath } from "./InvoiceMath";

/** The two emails the admin panel sends: booking confirmation and invoice. Pure. */
export class InvoiceEmails {
  static readonly HOME_ZONE = InvoiceContract.DEFAULT_TIME_ZONE;
  /** The name emails and invoices are signed with. */
  static readonly SENDER = "Ahmed Raza";

  /** "Khawla Abdullah" -> "Khawla", for greetings. */
  static firstName(fullName: string): string {
    return fullName.trim().split(/\s+/)[0];
  }

  /** "Tuesday, 6 October 2026 at 14:00 GMT+4". */
  static when(instant: Date, timeZone: string): string {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    }).format(instant);
  }

  /** "6 Oct 2026" for a YYYY-MM-DD date. */
  static day(isoDate: string): string {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(
      new Date(`${isoDate}T00:00:00Z`),
    );
  }

  /** A line's period: "2026-10" -> "October 2026", "2026-10-14" -> "14 Oct 2026"; anything else as typed. */
  static period(value: string): string {
    if (/^\d{4}-\d{2}$/.test(value)) {
      return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${value}-01T00:00:00Z`));
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? InvoiceEmails.day(value) : value;
  }

  /** Label/value rows of a bank's details, skipping the empty ones. */
  static bankRows(bank: BankDetails): [string, string][] {
    const rows: [string, string][] = [
      ["Bank name", bank.bankName],
      ["Account title", bank.accountTitle],
      ["Account number", bank.accountNumber],
      ["IBAN", bank.iban],
      ["Branch", bank.branch],
      ["SWIFT / BIC", bank.swift],
    ];
    return rows.filter(([, value]) => value);
  }

  static confirmation(input: ConfirmationInput): EmailMessage {
    const start = new Date(input.start);
    const clientTime = InvoiceEmails.when(start, input.clientTimeZone);
    const dubaiTime = InvoiceEmails.when(start, InvoiceEmails.HOME_ZONE);
    const rows: [string, string | { html: string }][] = [
      ["Session", input.topic],
      [`When (${input.clientTimeZone})`, clientTime],
    ];
    if (input.clientTimeZone !== InvoiceEmails.HOME_ZONE) rows.push(["Dubai time", dubaiTime]);
    rows.push(["Duration", `${input.durationMinutes} minutes`]);
    if (input.location) rows.push(["Where", { html: EmailHtml.link(input.location) }]);

    const { whatsapp } = siteConfig.contact;
    const contact = `Need to reschedule or have a question? Reply to this email or message us on WhatsApp at ${whatsapp.display}.`;
    const day = new Intl.DateTimeFormat("en-GB", { timeZone: input.clientTimeZone, weekday: "short", day: "numeric", month: "short" }).format(start);
    const subject = `Session confirmed: ${input.topic}, ${day}`;

    const html = EmailHtml.document(
      subject,
      [
        EmailHtml.paragraph(`Hi ${InvoiceEmails.firstName(input.clientName)},`),
        EmailHtml.paragraph("Your session is confirmed. Here are the details:"),
        EmailHtml.table(rows),
        input.note ? EmailHtml.paragraph(input.note) : "",
        EmailHtml.paragraph(contact),
        EmailHtml.paragraph(`Best regards,\n${InvoiceEmails.SENDER}\n${siteConfig.name}`),
      ].join(""),
    );
    const text = [
      `Hi ${InvoiceEmails.firstName(input.clientName)},`,
      "",
      "Your session is confirmed. Here are the details:",
      "",
      ...rows.map(([label, value]) => `${label}: ${typeof value === "string" ? value : input.location}`),
      ...(input.note ? ["", input.note] : []),
      "",
      contact,
      "",
      `Best regards,\n${InvoiceEmails.SENDER}\n${siteConfig.name}`,
    ].join("\n");
    return { subject, html, text };
  }

  /** "+971 50 230 4045" / "050 230 4045" / "00971…" -> "971502304045"; empty when there's no usable number. */
  static whatsappNumber(phone: string): string {
    const digits = phone.replace(/\D/g, "").replace(/^00/, "");
    if (/^0\d{8,9}$/.test(digits)) return `971${digits.slice(1)}`; // UAE local format
    return digits.length >= 8 ? digits : "";
  }

  /**
   * A wa.me link that opens a chat with the client, the message prefilled with the
   * invoice link. Without a usable phone number WhatsApp asks which chat to send it to.
   */
  static whatsapp(invoice: Invoice, url: string): string {
    const amount = InvoiceMath.money(invoice.totalMinor, invoice.currency);
    const text = [
      `Hi ${InvoiceEmails.firstName(invoice.clientName)}, here is your invoice ${invoice.number ?? ""} for ${amount}, due ${InvoiceEmails.day(invoice.dueDate)}.`,
      "",
      `View or download it here: ${url}`,
      "",
      `Thank you,\n${InvoiceEmails.SENDER}\n${siteConfig.name}`,
    ].join("\n");
    return `https://wa.me/${InvoiceEmails.whatsappNumber(invoice.clientPhone)}?text=${encodeURIComponent(text)}`;
  }

  /** Summary plus a link to the printable invoice page. Only for issued invoices. */
  static invoice(invoice: Invoice, url: string): EmailMessage {
    const number = invoice.number ?? "";
    const amount = InvoiceMath.money(invoice.totalMinor, invoice.currency);
    const rows: [string, string][] = [
      ["Invoice", number],
      ["Issued", invoice.issueDate ? InvoiceEmails.day(invoice.issueDate) : ""],
      ["Due", InvoiceEmails.day(invoice.dueDate)],
      ["Amount due", amount],
    ];
    const subject = `Invoice ${number} from ${siteConfig.name}`;
    const bankRows = invoice.bank ? InvoiceEmails.bankRows(invoice.bank) : [];
    const hasPayment = bankRows.length > 0 || invoice.paymentInstructions !== "";

    const html = EmailHtml.document(
      subject,
      [
        EmailHtml.paragraph(`Hi ${InvoiceEmails.firstName(invoice.clientName)},`),
        EmailHtml.paragraph(`Please find your invoice ${number} for ${amount}.`),
        EmailHtml.table(rows),
        EmailHtml.button(url, "View and print invoice"),
        hasPayment ? '<p style="margin:0 0 6px;font-weight:600">How to pay</p>' : "",
        bankRows.length > 0 ? EmailHtml.table([...bankRows, ["Reference", number]]) : "",
        invoice.paymentInstructions ? EmailHtml.paragraph(invoice.paymentInstructions) : "",
        EmailHtml.paragraph("Questions about this invoice? Just reply to this email."),
        EmailHtml.paragraph(`Thank you,\n${InvoiceEmails.SENDER}\n${siteConfig.name}`),
      ].join(""),
    );
    const text = [
      `Hi ${InvoiceEmails.firstName(invoice.clientName)},`,
      "",
      `Please find your invoice ${number} for ${amount}.`,
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      `View and print the invoice: ${url}`,
      ...(hasPayment ? ["", "How to pay:"] : []),
      ...(bankRows.length > 0 ? [...bankRows, ["Reference", number]].map(([label, value]) => `${label}: ${value}`) : []),
      ...(invoice.paymentInstructions ? [invoice.paymentInstructions] : []),
      "",
      "Questions about this invoice? Just reply to this email.",
      "",
      `Thank you,\n${InvoiceEmails.SENDER}\n${siteConfig.name}`,
    ].join("\n");
    return { subject, html, text };
  }
}
