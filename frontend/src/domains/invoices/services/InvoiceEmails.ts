import { siteConfig } from "@/core/config/site";
import { EmailHtml, type EmailMessage } from "@/core/email/EmailHtml";

import type { BankDetails, ConfirmationInput, Invoice } from "../types";
import { InvoiceContract } from "./InvoiceContract";
import { InvoiceMath } from "./InvoiceMath";

/** The two emails the admin panel sends: booking confirmation and invoice. Pure. */
export class InvoiceEmails {
  static readonly HOME_ZONE = InvoiceContract.DEFAULT_TIME_ZONE;

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
        EmailHtml.paragraph(`Hi ${input.clientName},`),
        EmailHtml.paragraph("Your session is confirmed. Here are the details:"),
        EmailHtml.table(rows),
        input.note ? EmailHtml.paragraph(input.note) : "",
        EmailHtml.paragraph(contact),
        EmailHtml.paragraph(`Best regards,\n${whatsapp.owner}\n${siteConfig.name}`),
      ].join(""),
    );
    const text = [
      `Hi ${input.clientName},`,
      "",
      "Your session is confirmed. Here are the details:",
      "",
      ...rows.map(([label, value]) => `${label}: ${typeof value === "string" ? value : input.location}`),
      ...(input.note ? ["", input.note] : []),
      "",
      contact,
      "",
      `Best regards,\n${whatsapp.owner}\n${siteConfig.name}`,
    ].join("\n");
    return { subject, html, text };
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
    const owner = siteConfig.contact.whatsapp.owner;
    const bankRows = invoice.bank ? InvoiceEmails.bankRows(invoice.bank) : [];
    const hasPayment = bankRows.length > 0 || invoice.paymentInstructions !== "";

    const html = EmailHtml.document(
      subject,
      [
        EmailHtml.paragraph(`Hi ${invoice.clientName},`),
        EmailHtml.paragraph(`Please find invoice ${number} for ${amount} below.`),
        EmailHtml.table(rows),
        EmailHtml.button(url, "View and print invoice"),
        hasPayment ? '<p style="margin:0 0 6px;font-weight:600">How to pay</p>' : "",
        bankRows.length > 0 ? EmailHtml.table([...bankRows, ["Reference", number]]) : "",
        invoice.paymentInstructions ? EmailHtml.paragraph(invoice.paymentInstructions) : "",
        EmailHtml.paragraph("Questions about this invoice? Just reply to this email."),
        EmailHtml.paragraph(`Thank you,\n${owner}\n${siteConfig.name}`),
      ].join(""),
    );
    const text = [
      `Hi ${invoice.clientName},`,
      "",
      `Please find invoice ${number} for ${amount} below.`,
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
      `Thank you,\n${owner}\n${siteConfig.name}`,
    ].join("\n");
    return { subject, html, text };
  }
}
