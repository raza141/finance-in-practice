export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type Currency = "AED" | "USD" | "PKR" | "GBP" | "EUR";

/** How a line is billed: per hour, per month, on demand, or a fixed contract. */
export type ItemUnit = "hour" | "month" | "on-demand" | "contract";

export interface InvoiceItem {
  /** Usually a course title. */
  description: string;
  /** Optional second line under the title. Absent on invoices issued before 013. */
  detail?: string;
  /** Which month or session this line pays for, e.g. "October 2026" or "Session · 14 Oct 2026". */
  period?: string;
  /** Absent on invoices issued before 013. */
  unit?: ItemUnit;
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
  /** The saved client this bills, if any; the contact fields below are the snapshot printed. */
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
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
  /** The bank shown under "Payment information"; its details are snapshotted on save. */
  bankAccountId: string | null;
}

export interface Invoice extends InvoiceInput, InvoiceTotals {
  id: string;
  /** Snapshot of the bank when last saved; null on older invoices or when none was chosen. */
  bank: BankDetails | null;
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
  /** Sum of `payments`; the balance due is totalMinor - paidMinor. */
  paidMinor: number;
  /** Oldest first. */
  payments: InvoicePayment[];
  /** Times the client opened the invoice link (admin views excluded). */
  viewCount: number;
  firstViewedAt: Date | null;
  lastViewedAt: Date | null;
}

/** Money received against an invoice, e.g. an advance or the balance. */
export interface InvoicePayment {
  id: string;
  amountMinor: number;
  /** YYYY-MM-DD, the day the money arrived. */
  paidOn: string;
  note: string;
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
  firstViewedAt: Date | null;
  paidMinor: number;
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

/** Invoice money for one currency, for the admin dashboard. Months are Dubai calendar months. */
export interface CurrencyStats {
  currency: Currency;
  paidThisMonthMinor: number;
  paidLastMonthMinor: number;
  /** Issued and unpaid. */
  pendingCount: number;
  pendingMinor: number;
  /** Unpaid past the due date (a subset of pending). */
  overdueCount: number;
  overdueMinor: number;
}

export interface InvoiceDashboard {
  /** Only currencies that have invoices. */
  currencies: CurrencyStats[];
  drafts: number;
  /** Paid totals for the last six months (current included), "YYYY-MM" in Dubai. */
  paidByMonth: { month: string; currency: Currency; totalMinor: number }[];
}

export interface ClientDashboard {
  total: number;
  newThisMonth: number;
  /** Clients on each payment-plan basis. */
  byPlan: Record<ItemUnit, number>;
  /** Monthly plans: fee x courses (at least one), per currency. */
  expectedMonthly: { currency: Currency; totalMinor: number }[];
}

export interface ClientInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  /** Course titles the client is enrolled in. */
  courses: string[];
  /** Payment plan: how they are billed, and the fee per hour / month / contract. */
  planUnit: ItemUnit | null;
  planFeeMinor: number | null;
  planCurrency: Currency;
  /** e.g. "3 instalments", "due on the 1st". */
  planNotes: string;
}

export interface Client extends ClientInput {
  id: string;
}

export interface BankDetails {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  branch: string;
  swift: string;
}

export interface BankAccount extends BankDetails {
  id: string;
  isDefault: boolean;
}
