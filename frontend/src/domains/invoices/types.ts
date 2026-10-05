export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type Currency = "AED" | "USD" | "PKR" | "GBP" | "EUR";

export interface InvoiceItem {
  description: string;
  /** Up to two decimals (e.g. 1.5 hours). */
  quantity: number;
  unitMinor: number;
  amountMinor: number;
}

export interface InvoiceTotals {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

/** What the invoice form saves (validated). Totals are derived from it server-side. */
export interface InvoiceInput {
  bookingUid: string | null;
  clientName: string;
  clientEmail: string;
  currency: Currency;
  items: InvoiceItem[];
  discountMinor: number;
  /** Basis points: 500 = 5%. */
  taxRateBp: number;
  trn: string;
  /** YYYY-MM-DD. */
  dueDate: string;
  notes: string;
  paymentInstructions: string;
}

export interface Invoice extends InvoiceInput, InvoiceTotals {
  id: string;
  /** Null for drafts; e.g. "FIP-2026-0001" once issued. */
  number: string | null;
  token: string;
  status: InvoiceStatus;
  /** YYYY-MM-DD in Dubai, set when issued. */
  issueDate: string | null;
  createdAt: Date;
  sentAt: Date | null;
  paidAt: Date | null;
  voidedAt: Date | null;
}

export interface InvoiceSummary {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  clientName: string;
  currency: Currency;
  totalMinor: number;
  issueDate: string | null;
  dueDate: string;
  createdAt: Date;
  lastEmailedAt: Date | null;
}

export type EmailKind = "invoice" | "confirmation";

export interface EmailLogEntry {
  id: string;
  kind: EmailKind;
  toEmail: string;
  subject: string;
  invoiceId: string | null;
  bookingUid: string | null;
  providerId: string | null;
  sentAt: Date;
}

/** A booking confirmation to email (validated). */
export interface ConfirmationInput {
  bookingUid: string | null;
  clientName: string;
  clientEmail: string;
  /** Session start, ISO instant. */
  start: string;
  durationMinutes: number;
  /** IANA zone the client sees the time in. */
  clientTimeZone: string;
  topic: string;
  /** Meeting link (http/https) or a place. */
  location: string;
  note: string;
}

/** Values to prefill a form with, from a Cal.com booking. Strings as the inputs take them. */
export interface BookingPrefill {
  bookingUid: string;
  clientName: string;
  clientEmail: string;
  clientTimeZone: string;
  /** YYYY-MM-DD and HH:mm in clientTimeZone. */
  date: string;
  time: string;
  durationMinutes: number;
  topic: string;
  location: string;
}
