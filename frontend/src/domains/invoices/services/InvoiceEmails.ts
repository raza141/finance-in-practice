import { siteConfig } from "@/core/config/site";
import { EmailHtml, type EmailMessage } from "@/core/email/EmailHtml";

import { SettingsContract } from "@/domains/settings/services/SettingsContract";
import type { BillingSettings } from "@/domains/settings/types";

import type { BankDetails, ConfirmationInput, Invoice } from "../types";
import { InvoiceContract } from "./InvoiceContract";
import { InvoiceMath } from "./InvoiceMath";

/** The emails and WhatsApp messages the admin panel sends: booking confirmation and billing documents. Pure. */
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
    // A range: "1–15 October 2026", "1 October–30 November 2026", "1 December 2026–31 January 2027".
    const range = /^(\d{4})-(\d{2})-(\d{2})\/(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (range) {
      const long = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`));
      const [from, to] = [value.slice(0, 10), value.slice(11)];
      if (from === to) return long(from);
      const sameYear = range[1] === range[4];
      const start = sameYear && range[2] === range[5] ? String(Number(range[3])) : long(from).replace(sameYear ? ` ${range[1]}` : "", "");
      return `${start}–${long(to)}`;
    }
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
    const contact = `Rescheduling requests and questions can be sent as a reply to this email or by WhatsApp to ${whatsapp.display}.`;
    const day = new Intl.DateTimeFormat("en-GB", { timeZone: input.clientTimeZone, weekday: "short", day: "numeric", month: "short" }).format(start);
    const subject = `Session confirmed: ${input.topic}, ${day}`;

    const html = EmailHtml.document(
      subject,
      [
        EmailHtml.paragraph(`Hi ${InvoiceEmails.firstName(input.clientName)},`),
        EmailHtml.paragraph("The session is confirmed. Details:"),
        EmailHtml.table(rows),
        input.note ? EmailHtml.paragraph(input.note) : "",
        EmailHtml.paragraph(contact),
        EmailHtml.paragraph(`Best regards,\n${InvoiceEmails.SENDER}\n${siteConfig.name}`),
      ].join(""),
    );
    const text = [
      `Hi ${InvoiceEmails.firstName(input.clientName)},`,
      "",
      "The session is confirmed. Details:",
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

  /** Placeholder values for a document's message templates (Settings). */
  static placeholders(doc: Invoice, url: string, settings: BillingSettings): Record<(typeof SettingsContract.PLACEHOLDERS)[number], string> {
    const money = (minor: number) => InvoiceMath.money(minor, doc.currency);
    const amount = doc.docType === "receipt" && doc.receiptPayment ? doc.receiptPayment.amountMinor : doc.totalMinor;
    return {
      firstName: InvoiceEmails.firstName(doc.clientName),
      number: doc.number ?? "",
      amount: money(amount),
      balance: money(doc.totalMinor - doc.paidMinor - doc.creditedMinor),
      dueDate: InvoiceEmails.day(doc.dueDate),
      link: url,
      sender: settings.business.sender,
      business: settings.business.name,
    };
  }

  /**
   * The WhatsApp message for a document, from its Settings template. A part-paid
   * invoice adds what is still due; a pasted payment link adds a "Pay online" line.
   */
  static whatsappText(doc: Invoice, url: string, settings: BillingSettings): string {
    const values = InvoiceEmails.placeholders(doc, url, settings);
    const extra = [
      ...(doc.docType === "invoice" && doc.paidMinor + doc.creditedMinor > 0 && doc.status === "sent"
        ? [`Received so far: ${InvoiceMath.money(doc.paidMinor + doc.creditedMinor, doc.currency)}. Balance due: ${values.balance}.`]
        : []),
      ...(InvoiceEmails.payOnline(doc, settings) ? [`Pay online: ${doc.paymentLink}`] : []),
    ];
    const text = SettingsContract.fill(settings.documents[doc.docType].whatsapp, values);
    if (extra.length === 0) return text;
    // Before the sign-off when the template ends with one, else at the end.
    const [body, ...signOff] = text.split(/\n\n(?=Thank you,)/);
    return [body, ...extra.map((line) => `\n${line}`), ...signOff.map((part) => `\n\n${part}`)].join("");
  }

  /** A wa.me link with the message prefilled. Without a usable phone number WhatsApp asks which chat to send it to. */
  static whatsapp(doc: Invoice, url: string, settings: BillingSettings): string {
    return `https://wa.me/${InvoiceEmails.whatsappNumber(doc.clientPhone)}?text=${encodeURIComponent(InvoiceEmails.whatsappText(doc, url, settings))}`;
  }

  /** The card / online payment link shows only when card payments are on in Settings. */
  static payOnline(doc: Pick<Invoice, "paymentLink" | "docType" | "status">, settings: BillingSettings): boolean {
    return settings.card.show && doc.paymentLink !== "" && doc.docType === "invoice" && doc.status === "sent";
  }

  /** Summary plus a link to the printable document page. Only for issued documents. */
  static document(doc: Invoice, url: string, settings: BillingSettings): EmailMessage {
    const label = SettingsContract.DOCUMENT_TYPES[doc.docType];
    const values = InvoiceEmails.placeholders(doc, url, settings);
    const number = values.number;
    const isInvoice = doc.docType === "invoice";
    // A paid invoice says when it was paid and leaves out how to pay.
    const paid = isInvoice && doc.status === "paid";
    const paidOn = paid ? doc.payments.at(-1)?.paidOn : undefined;
    const rows: [string, string][] = [
      [label, number],
      ["Issued", doc.issueDate ? InvoiceEmails.day(doc.issueDate) : ""],
      ...(isInvoice ? ([paid ? ["Paid on", paidOn ? InvoiceEmails.day(paidOn) : ""] : ["Due", values.dueDate]] as [string, string][]) : []),
      ...(doc.docType === "quote" ? ([["Valid until", values.dueDate]] as [string, string][]) : []),
      [isInvoice ? "Amount due" : doc.docType === "receipt" ? "Amount received" : "Amount", isInvoice ? values.balance : values.amount],
    ];
    const subject = `${label} ${number} from ${settings.business.name}`;
    const bankRows = isInvoice && !paid && doc.bank ? InvoiceEmails.bankRows(doc.bank) : [];
    const instructions = isInvoice && !paid ? doc.paymentInstructions : "";
    const payOnline = InvoiceEmails.payOnline(doc, settings);
    const hasPayment = bankRows.length > 0 || instructions !== "" || payOnline;
    const opening = SettingsContract.fill(settings.documents[doc.docType].email, values);
    const closing = `Questions about this ${label.toLowerCase()} can be sent as a reply to this email.`;
    const signOff = `Thank you,\n${settings.business.sender}\n${settings.business.name}`;
    const paymentRows: [string, string][] = [...bankRows, ...(bankRows.length > 0 ? ([["Reference", number]] as [string, string][]) : [])];

    const html = EmailHtml.document(
      subject,
      [
        EmailHtml.paragraph(`Hi ${values.firstName},`),
        EmailHtml.paragraph(opening),
        EmailHtml.table(rows),
        EmailHtml.button(url, `View and print ${label.toLowerCase()}`),
        hasPayment ? '<p style="margin:0 0 6px;font-weight:600">Payment details</p>' : "",
        paymentRows.length > 0 ? EmailHtml.table(paymentRows) : "",
        payOnline ? EmailHtml.paragraph(`Pay online: ${doc.paymentLink}${settings.card.note ? ` (${settings.card.note})` : ""}`) : "",
        instructions ? EmailHtml.paragraph(instructions) : "",
        EmailHtml.paragraph(closing),
        EmailHtml.paragraph(signOff),
      ].join(""),
    );
    const text = [
      `Hi ${values.firstName},`,
      "",
      opening,
      "",
      ...rows.map(([key, value]) => `${key}: ${value}`),
      "",
      `View and print the ${label.toLowerCase()}: ${url}`,
      ...(hasPayment ? ["", "Payment details:"] : []),
      ...paymentRows.map(([key, value]) => `${key}: ${value}`),
      ...(payOnline ? [`Pay online: ${doc.paymentLink}${settings.card.note ? ` (${settings.card.note})` : ""}`] : []),
      ...(instructions ? [instructions] : []),
      "",
      closing,
      "",
      signOff,
    ].join("\n");
    return { subject, html, text };
  }
}
