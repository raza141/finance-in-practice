import type { DocumentType } from "@/domains/settings/types";

export type { DocumentType };

/** "sent" is shown as Issued. Quotes also end as accepted or declined; "expired" and "overdue" are derived from dates. */
export type InvoiceStatus = "draft" | "sent" | "paid" | "void" | "accepted" | "declined";
export type Currency = "AED" | "USD" | "PKR" | "GBP" | "EUR";

/** How a line is billed (labels, default rates and layouts in Settings). Milestones belong to consultancy layouts. */
export type ItemUnit = "month" | "session" | "hour" | "milestone" | "fee";
/** Units on documents issued before migration 029; shown as issued, never offered for new lines. */
export type LegacyUnit = "on-demand" | "contract";

/** "custom" counts `termsDays`; "date" keeps the typed due date. "monthly" and "after_delivery" are kept for documents issued before migration 030. */
export type PaymentTerms = "upfront" | "on_receipt" | "net7" | "net14" | "net30" | "custom" | "date" | "monthly" | "after_delivery";
export type PaymentMethod = "bank" | "cash" | "card";
export type DocumentLayout = "standard" | "consultancy";

/** The extra sections of a consultancy document; the line items are its Fees. */
export interface ConsultancySections {
  scope: string;
  deliverables: string;
  expenses: string;
  assumptions: string;
}

export interface InvoiceItem {
  /** Usually a course title. */
  description: string;
  /** Optional second line under the title. Absent on invoices issued before 013. */
  detail?: string;
  /** Which month or session this line pays for, e.g. "October 2026" or "Session · 14 Oct 2026". */
  period?: string;
  /** Absent on invoices issued before 013. */
  unit?: ItemUnit | LegacyUnit;
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
  docType: DocumentType;
  /** Receipt -> the invoice it pays; credit note -> the invoice it credits; invoice -> the quote it came from. */
  relatedId: string | null;
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
  /** YYYY-MM-DD. Invoices with day-count terms are re-dated from the issue date when issued; quotes: valid until. */
  dueDate: string;
  notes: string;
  paymentInstructions: string;
  /** The bank shown under "Payment information"; its details are snapshotted on save. */
  bankAccountId: string | null;
  paymentTerms: PaymentTerms;
  /** Days to pay with "custom" terms; null otherwise. */
  termsDays: number | null;
  /** A pasted card / online payment URL; printed as "Pay online" when card payments are on in Settings. */
  paymentLink: string;
  layout: DocumentLayout;
  sections: ConsultancySections;
  /** Repeats monthly: "Create this month's drafts" copies it forward. */
  recurring: boolean;
}

export interface Invoice extends InvoiceInput, InvoiceTotals {
  id: string;
  /** Snapshot of the bank when last saved; null on older invoices or when none was chosen. */
  bank: BankDetails | null;
  /** Null for drafts; frozen at issue, e.g. "FIP-INV-2026-0002" (older: "FIP-2026-0001"). */
  number: string | null;
  /** The related document's number, for display ("Payment for FIP-INV-…"). */
  relatedNumber: string | null;
  /** On a payment receipt: the payment it confirms. */
  paymentId: string | null;
  /** On a recurring copy: the document it was copied from. */
  recursFrom: string | null;
  /** Manual extension of the client link ("Resend link"). */
  linkValidUntil: Date | null;
  token: string;
  status: InvoiceStatus;
  /** YYYY-MM-DD in Dubai, set when issued. */
  issueDate: string | null;
  createdAt: Date;
  sentAt: Date | null;
  paidAt: Date | null;
  voidedAt: Date | null;
  /** Sum of `payments`. */
  paidMinor: number;
  /** Sum of issued credit notes against this invoice. Balance due = total - paid - credited. */
  creditedMinor: number;
  /** Oldest first. */
  payments: InvoicePayment[];
  /** On a receipt: the payment it confirms (date, amount, method, reference). */
  receiptPayment: InvoicePayment | null;
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
  method: PaymentMethod;
  /** Bank transfer or provider reference. */
  reference: string;
  /** Uploaded proof (receipt screenshot), if any. */
  proofUrl: string | null;
  /** The payment receipt issued for it. */
  receiptId: string | null;
}

/** One line of a document's history: created, issued, shared, paid… */
export interface DocumentEvent {
  at: Date;
  actor: string;
  event: string;
  detail: string;
}

export interface InvoiceSummary {
  id: string;
  docType: DocumentType;
  creditedMinor: number;
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
  /** Sent quotes still within their valid-until date. */
  quotesAwaiting: number;
  /** Recurring invoices whose next month has no draft yet. */
  recurringDue: number;
  /** Paid totals for the last six months (current included), "YYYY-MM" in Dubai. */
  paidByMonth: { month: string; currency: Currency; totalMinor: number }[];
}

/** One line of a client's account: a charge (debit) or what reduces it (credit). */
export interface LedgerEntry {
  /** YYYY-MM-DD. */
  date: string;
  kind: "invoice" | "receipt" | "credit_note" | "payment";
  documentId: string;
  number: string | null;
  currency: Currency;
  debitMinor: number;
  creditMinor: number;
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
