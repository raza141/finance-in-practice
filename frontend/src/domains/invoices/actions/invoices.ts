"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Database } from "@/core/db/Database";
import { ApiError } from "@/core/http/ApiError";
import { ResendClient } from "@/core/email/ResendClient";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";
import type { BillingSettings } from "@/domains/settings/types";

import { BankAccountRepository } from "../server/BankAccountRepository";
import { ClientRepository } from "../server/ClientRepository";
import { InvoiceRepository, type PaymentRecord } from "../server/InvoiceRepository";
import { ProofStorage } from "../server/ProofStorage";
import { DocumentFormat } from "../services/DocumentFormat";
import { InvoiceContract, type ConfirmationFieldErrors, type InvoiceFieldErrors } from "../services/InvoiceContract";
import { InvoiceEmails } from "../services/InvoiceEmails";
import { InvoiceMath } from "../services/InvoiceMath";
import type { BankDetails, DocumentType, Invoice, InvoiceInput } from "../types";

/**
 * Admin actions for every billing document (invoices, receipts, quotes,
 * credit notes) and confirmations. Each one re-checks the session: server
 * actions are public POST endpoints regardless of which page renders them.
 */

export interface InvoiceFormState {
  message?: string;
  errors?: InvoiceFieldErrors;
}

export interface ConfirmationFormState {
  sentTo?: string;
  message?: string;
  errors?: ConfirmationFieldErrors;
}

export interface QuickReceiptFormState {
  message?: string;
  errors?: Partial<Record<string, string>>;
}

const NO_EMAIL = "Email is not configured (RESEND_API_KEY, EMAIL_FROM).";
const SYSTEM = "system";
const NO_SECTIONS = { scope: "", deliverables: "", expenses: "", assumptions: "" };

/** The repository, and who is acting (for the document history). */
async function session(): Promise<{ repo: InvoiceRepository; actor: string }> {
  const admin = await AdminAuth.requireOwner();
  const repo = InvoiceRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return { repo, actor: admin.name || admin.email };
}

/** Origin of this request, for the public document link in emails. */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const today = () => new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();

/**
 * Server-side links for a parsed document: checks the saved client exists (or
 * saves a new one when asked) and snapshots the chosen bank's details. The
 * browser only ever sends ids. Returns an error message instead when one is gone.
 */
async function resolveLinks(input: InvoiceInput, saveClient: boolean): Promise<{ input: InvoiceInput; bank: BankDetails | null } | string> {
  const clients = ClientRepository.fromEnv();
  const banks = BankAccountRepository.fromEnv();
  if (!clients || !banks) throw new Error("DATABASE_URL is not configured");

  let clientId = input.clientId;
  if (clientId && !(await clients.byId(clientId))) return "That saved client no longer exists. Choose another or clear it.";
  // An email already on file links to that client instead of saving a duplicate.
  if (!clientId && saveClient) {
    clientId =
      (input.clientEmail ? (await clients.byEmail(input.clientEmail))?.id : undefined) ??
      (await clients.create({ name: input.clientName, email: input.clientEmail, phone: input.clientPhone, address: input.clientAddress }));
  }

  let bank: BankDetails | null = null;
  if (input.bankAccountId) {
    const account = await banks.byId(input.bankAccountId);
    if (!account) return "That bank account no longer exists. Choose another.";
    bank = BankAccountRepository.details(account);
  }
  return { input: { ...input, clientId }, bank };
}

/** VAT follows Settings: off -> no VAT and no TRN; on -> the TRN is snapshotted onto the document. */
function applyVat(input: InvoiceInput, settings: BillingSettings): InvoiceInput {
  return settings.vat.registered ? { ...input, trn: settings.vat.trn } : { ...input, taxRateBp: 0, trn: "" };
}

/**
 * Details a UAE tax invoice must carry, checked before a VAT document is issued.
 * ponytail: VAT must be shown in AED; foreign-currency tax invoices (with an AED conversion) are not supported, so they are refused.
 */
function taxProblem(doc: Invoice): string | null {
  if (!doc.trn || doc.taxRateBp === 0 || doc.docType === "quote") return null;
  if (doc.currency !== "AED") return "A tax invoice must show VAT in AED: issue it in AED.";
  if (!doc.clientAddress.trim() && doc.docType !== "receipt") return "A tax invoice needs the client's address.";
  return null;
}

/**
 * Draft -> issued with the type's prefix, after the checks the type needs. An
 * invoice with day-count terms is due that many days after its issue date (set
 * in the same statement); with "date" terms the typed date must not be past.
 * Returns an error message, or null.
 */
async function issueDocument(repo: InvoiceRepository, id: string, settings: BillingSettings, actor: string): Promise<string | null> {
  const doc = await repo.byId(id);
  if (!doc || doc.status !== "draft") return "This document was already issued or deleted.";
  const problem = taxProblem(doc);
  if (problem) return problem;
  const dueDays = doc.docType === "invoice" ? InvoiceContract.termDays(doc.paymentTerms, doc.termsDays) : null;
  if (doc.docType === "invoice" && dueDays === null && doc.dueDate < today()) return "The due date is before today: choose a later date or day-count terms.";
  if (doc.docType === "quote" && doc.dueDate < today()) return "The valid-until date has passed: choose a later date.";
  if (doc.docType === "credit_note") {
    const invoice = doc.relatedId ? await repo.byId(doc.relatedId) : null;
    if (!invoice || (invoice.status !== "sent" && invoice.status !== "paid")) return "A credit note needs an issued invoice (open or paid).";
    if (doc.currency !== invoice.currency) return "A credit note must be in the invoice's currency.";
    // Up to what hasn't been credited yet. On a paid invoice the credit is owed back (the account shows it as in credit).
    const creditable = DocumentFormat.creditable(invoice);
    if (doc.totalMinor > creditable) return `The credit is larger than what is left to credit on the invoice (${InvoiceMath.money(creditable, invoice.currency)}).`;
  }
  if (!(await repo.issue(id, settings.prefixes[doc.docType], actor, dueDays))) return "This document was already issued.";
  if (doc.docType === "credit_note" && doc.relatedId) await repo.settleIfCovered(doc.relatedId, actor);
  return null;
}

/** Emails an issued document and logs it. Returns an error message, or null when sent. */
async function emailDocument(repo: InvoiceRepository, doc: Invoice, settings: BillingSettings, actor: string): Promise<string | null> {
  const resend = ResendClient.fromEnv();
  if (!resend) return NO_EMAIL;
  if (!doc.clientEmail) return "This document has no client email. Share it on WhatsApp instead.";
  const message = InvoiceEmails.document(doc, `${await origin()}/invoice/${doc.token}`, settings);
  let providerId: string;
  try {
    providerId = await resend.send(doc.clientEmail, message);
  } catch (error) {
    if (error instanceof ApiError) return error.message;
    throw error;
  }
  await repo.logEmail({ kind: "invoice", toEmail: doc.clientEmail, subject: message.subject, invoiceId: doc.id, bookingUid: doc.bookingUid, providerId });
  await repo.logEvent(doc.id, actor, "shared", `email to ${doc.clientEmail}`);
  return null;
}

const withReason = (path: string, notice: string, reason?: string) => `${path}?notice=${notice}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`;

/**
 * Save a draft invoice, quote or credit note; with intent "issue" also number
 * and freeze it, and with "send" email it too. A failed email leaves it
 * issued: the detail page offers to resend.
 */
export async function saveInvoice(_state: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const { repo, actor } = await session();
  const parsed = InvoiceContract.parseInvoice(Object.fromEntries(formData));
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };

  const intent = formData.get("intent");
  if (intent === "send" && !ResendClient.fromEnv()) return { message: NO_EMAIL };
  if (intent === "send" && !parsed.input.clientEmail) return { message: "Add the client's email to send it, or issue it and share it on WhatsApp." };

  const settings = await SettingsRepository.load();
  const resolved = await resolveLinks(applyVat(parsed.input, settings), formData.get("saveClient") === "on");
  if (typeof resolved === "string") return { message: resolved };

  let id = formData.get("id");
  if (typeof id === "string" && id) {
    if (!(await repo.updateDraft(id, resolved.input, resolved.bank, actor))) return { message: "This document was already issued or deleted." };
  } else {
    id = await repo.createDraft(resolved.input, resolved.bank, actor);
  }

  let notice = "saved";
  if (intent === "issue" || intent === "send") {
    const error = await issueDocument(repo, id, settings, actor);
    if (error) redirect(withReason(`/admin/invoices/${id}`, "issue-failed", error));
    notice = "issued";
    if (intent === "send") {
      const doc = await repo.byId(id);
      const failed = doc && (await emailDocument(repo, doc, settings, actor));
      notice = failed ? "email-failed" : "emailed";
      if (failed) console.error(`Document email failed for ${id}: ${failed}`);
    }
  }
  redirect(`/admin/invoices/${id}?notice=${notice}`);
}

export async function resendInvoice(formData: FormData): Promise<void> {
  const { repo, actor } = await session();
  const doc = await repo.byId(String(formData.get("id")));
  if (!doc || doc.status === "draft" || doc.status === "void") return;
  const error = await emailDocument(repo, doc, await SettingsRepository.load(), actor);
  if (error) console.error(`Document email failed for ${doc.id}: ${error}`);
  redirect(`/admin/invoices/${doc.id}?notice=${error ? "email-failed" : "emailed"}`);
}

/** "Resend link": keeps the client link working 90 more days, and emails it again when the client has an email. */
export async function renewLink(formData: FormData): Promise<void> {
  const { repo, actor } = await session();
  const id = String(formData.get("id"));
  if (!(await repo.extendLink(id, actor))) return;
  const doc = await repo.byId(id);
  const emailed = doc?.clientEmail && ResendClient.fromEnv() ? !(await emailDocument(repo, doc, await SettingsRepository.load(), actor)) : false;
  redirect(`/admin/invoices/${id}?notice=${emailed ? "link-emailed" : "link-renewed"}`);
}

const SHARE_CHANNELS = { "whatsapp-open": "opened in WhatsApp", "whatsapp-copy": "WhatsApp message copied" } as const;
export type ShareChannel = keyof typeof SHARE_CHANNELS;

/** Logs a share from the share panel. Best effort: the share itself never waits on it. */
export async function logShare(id: string, channel: ShareChannel): Promise<void> {
  const { repo, actor } = await session();
  if (!InvoiceRepository.isId(id) || !Object.hasOwn(SHARE_CHANNELS, channel)) return;
  await repo.logEvent(id, actor, "shared", SHARE_CHANNELS[channel]);
}

/** The receipt issued for a payment recorded against an invoice. */
async function paymentReceipt(repo: InvoiceRepository, invoice: Invoice, paymentId: string, amountMinor: number, paidOn: string, settings: BillingSettings): Promise<void> {
  const id = await repo.createDraft(
    {
      docType: "receipt",
      relatedId: invoice.id,
      bookingUid: null,
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientPhone: invoice.clientPhone,
      clientAddress: invoice.clientAddress,
      currency: invoice.currency,
      items: [{ description: `Payment for invoice ${invoice.number ?? ""}`, unit: "fee", quantity: 1, unitMinor: amountMinor, amountMinor }],
      discountMinor: 0,
      taxRateBp: 0,
      trn: "",
      dueDate: paidOn,
      notes: "",
      paymentInstructions: "",
      bankAccountId: null,
      paymentTerms: "upfront",
      termsDays: null,
      paymentLink: "",
      layout: "standard",
      sections: NO_SECTIONS,
      recurring: false,
    },
    null,
    SYSTEM,
  );
  await repo.issue(id, settings.prefixes.receipt, SYSTEM);
  await repo.completeReceipt(id, paymentId);
}

/**
 * The uploaded proof file, stored privately. A wrong file type or size is an
 * error; a storage failure (e.g. a public-only Blob store) is not: the payment
 * is still recorded, without proof, and `lost` says so.
 */
async function storeProof(formData: FormData, invoiceId: string): Promise<{ url: string | null; lost: boolean } | string> {
  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) return { url: null, lost: false };
  const problem = ProofStorage.verify(file);
  if (problem) return problem;
  try {
    return { url: await ProofStorage.upload(file, invoiceId), lost: false };
  } catch (error) {
    console.error("Payment proof upload failed", error);
    return { url: null, lost: true };
  }
}

/** An advance or part payment; the one that clears the balance marks the invoice paid. A receipt is issued for each. */
export async function recordInvoicePayment(formData: FormData): Promise<void> {
  const { repo, actor } = await session();
  const id = String(formData.get("id"));
  const path = `/admin/invoices/${id}`;
  const parsed = InvoiceContract.parsePayment(Object.fromEntries(formData));
  if (typeof parsed === "string") redirect(withReason(path, "payment-refused", parsed));
  // The same form sent twice (double-click, retry): the first one already recorded it.
  if (parsed.submissionKey && (await repo.paymentByKey(parsed.submissionKey))) redirect(`${path}?notice=payment-duplicate`);
  const proof = await storeProof(formData, id);
  if (typeof proof === "string") redirect(withReason(path, "payment-refused", proof));
  const payment: PaymentRecord = { ...parsed, proofUrl: proof.url };
  const result = await repo.addPayment(id, payment, actor);
  if (!result && payment.submissionKey && (await repo.paymentByKey(payment.submissionKey))) redirect(`${path}?notice=payment-duplicate`);
  if (!result) redirect(withReason(path, "payment-refused"));
  const invoice = await repo.byId(id);
  if (invoice) await paymentReceipt(repo, invoice, result.paymentId, payment.amountMinor, payment.paidOn, await SettingsRepository.load());
  redirect(`${path}?notice=${result.settled ? "paid" : "payment"}${proof.lost ? "&proof=lost" : ""}`);
}

/** "Mark as paid": records the balance as received today by bank transfer, with its receipt. */
export async function markInvoicePaid(formData: FormData): Promise<void> {
  const { repo, actor } = await session();
  const id = String(formData.get("id"));
  const result = await repo.markPaid(id, actor);
  const invoice = result?.paymentId ? await repo.byId(id) : null;
  const payment = invoice?.payments.find((p) => p.id === result?.paymentId);
  if (invoice && payment) await paymentReceipt(repo, invoice, payment.id, payment.amountMinor, payment.paidOn, await SettingsRepository.load());
  redirect(`/admin/invoices/${id}?notice=paid`);
}

export async function removeInvoicePayment(formData: FormData): Promise<void> {
  const { repo, actor } = await session();
  const id = String(formData.get("id"));
  await repo.removePayment(id, String(formData.get("paymentId")), actor);
  redirect(`/admin/invoices/${id}?notice=payment-removed`);
}

export async function voidInvoice(formData: FormData): Promise<void> {
  const { repo, actor } = await session();
  const id = String(formData.get("id"));
  const doc = await repo.byId(id);
  if (doc?.docType === "receipt" && !doc.relatedId) await repo.voidQuickReceipt(id, actor);
  else await repo.void(id, actor);
  redirect(`/admin/invoices/${id}`);
}

type CopyMode = "duplicate" | "next-month" | "invoice-from-quote" | "credit-note";

/** A new draft from an existing document. The bank snapshot is copied as is; saving the draft refreshes it from the account. */
async function copyAsDraft(repo: InvoiceRepository, source: Invoice, mode: CopyMode, actor: string, recursFrom: string | null = null): Promise<string> {
  const nextMonth = mode === "next-month";
  const roll = (text: string) => (nextMonth ? InvoiceMath.nextMonthText(text) : text);
  const docType: DocumentType = mode === "invoice-from-quote" ? "invoice" : mode === "credit-note" ? "credit_note" : source.docType;
  const billable = docType === "invoice";
  const dueDate = nextMonth
    ? InvoiceMath.addMonths(source.dueDate, 1)
    : mode === "invoice-from-quote"
      ? InvoiceContract.dueDate(source.paymentTerms, today(), source.termsDays)
      : mode === "credit-note"
        ? today()
        : source.dueDate;
  const input: InvoiceInput = {
    docType,
    relatedId: mode === "invoice-from-quote" || mode === "credit-note" ? source.id : null,
    bookingUid: nextMonth ? null : source.bookingUid,
    clientId: source.clientId,
    clientName: source.clientName,
    clientEmail: source.clientEmail,
    clientPhone: source.clientPhone,
    clientAddress: source.clientAddress,
    currency: source.currency,
    items: source.items.map((item) => ({
      ...item,
      description: roll(item.description),
      ...(item.detail && { detail: roll(item.detail) }),
      ...(item.period && { period: nextMonth ? InvoiceMath.nextPeriod(item.period) : item.period }),
    })),
    discountMinor: source.discountMinor,
    taxRateBp: source.taxRateBp,
    trn: source.trn,
    dueDate,
    notes: mode === "credit-note" ? `Credit against invoice ${source.number ?? ""}.` : source.notes,
    paymentInstructions: billable ? source.paymentInstructions : "",
    bankAccountId: billable ? source.bankAccountId : null,
    paymentTerms: source.paymentTerms,
    termsDays: source.termsDays,
    paymentLink: billable ? source.paymentLink : "",
    layout: source.layout,
    sections: source.sections,
    recurring: billable && (nextMonth || mode === "duplicate") ? source.recurring : false,
  };
  return repo.createDraft(applyVat(input, await SettingsRepository.load()), billable || docType === "quote" ? source.bank : null, actor, recursFrom);
}

/** New draft with the same client, items and terms (the way to "edit" an issued document). */
export async function duplicateInvoice(formData: FormData): Promise<void> {
  const { repo, actor } = await session();
  const source = await repo.byId(String(formData.get("id")));
  if (!source) return;
  redirect(`/admin/invoices/${await copyAsDraft(repo, source, "duplicate", actor)}?notice=duplicated`);
}

/** Next month's invoice for a monthly client: same lines, due a month later, months moved on. */
export async function copyInvoiceForNextMonth(formData: FormData): Promise<void> {
  const { repo, actor } = await session();
  const source = await repo.byId(String(formData.get("id")));
  if (!source) return;
  redirect(`/admin/invoices/${await copyAsDraft(repo, source, "next-month", actor, source.recurring ? source.id : null)}?notice=next-month`);
}

/** "Create this month's drafts": one draft per recurring invoice that has none yet. Nothing is issued or sent. */
export async function createRecurringDrafts(): Promise<void> {
  const { repo, actor } = await session();
  const due = await repo.recurringDue();
  for (const source of due) await copyAsDraft(repo, source, "next-month", actor, source.id);
  redirect(`/admin/invoices?notice=recurring&count=${due.length}`);
}

/** Accept or decline a sent quote. */
export async function answerQuote(formData: FormData): Promise<void> {
  const { repo, actor } = await session();
  const id = String(formData.get("id"));
  await repo.answerQuote(id, formData.get("answer") === "declined" ? "declined" : "accepted", actor);
  redirect(`/admin/invoices/${id}`);
}

/**
 * Accepted quote -> one invoice draft linked to it. A quote that already has a
 * live invoice opens that one instead: a unique index backs this up when two
 * conversions race (double-click, retry). Void the invoice to convert again.
 */
export async function convertQuote(formData: FormData): Promise<void> {
  const { repo, actor } = await session();
  const quote = await repo.byId(String(formData.get("id")));
  if (!quote || quote.docType !== "quote" || quote.status !== "accepted") return;
  const existing = await repo.invoiceFromQuote(quote.id);
  if (existing) redirect(`/admin/invoices/${existing}?notice=quote-invoiced`);
  let id: string;
  try {
    id = await copyAsDraft(repo, quote, "invoice-from-quote", actor);
  } catch (error) {
    const raced = Database.isUniqueViolation(error) ? await repo.invoiceFromQuote(quote.id) : null;
    if (!raced) throw error;
    redirect(`/admin/invoices/${raced}?notice=quote-invoiced`);
  }
  redirect(`/admin/invoices/${id}?notice=from-quote`);
}

/** A draft credit note against an issued invoice (open or paid), prefilled with its lines (edit them down to the amount credited). */
export async function createCreditNote(formData: FormData): Promise<void> {
  const { repo, actor } = await session();
  const invoice = await repo.byId(String(formData.get("id")));
  if (!invoice || invoice.docType !== "invoice" || (invoice.status !== "sent" && invoice.status !== "paid")) return;
  redirect(`/admin/invoices/${await copyAsDraft(repo, invoice, "credit-note", actor)}?notice=credit-draft`);
}

export async function deleteDraftInvoice(formData: FormData): Promise<void> {
  const { repo } = await session();
  await repo.deleteDraft(String(formData.get("id")));
  redirect("/admin/invoices");
}

/**
 * A Quick Receipt: one session paid on the spot. Issues a receipt (no invoice)
 * and records its payment in one step. With VAT on, the amount is VAT-inclusive.
 */
export async function saveQuickReceipt(_state: QuickReceiptFormState, formData: FormData): Promise<QuickReceiptFormState> {
  const { repo, actor } = await session();
  const parsed = InvoiceContract.parseQuickReceipt(Object.fromEntries(formData));
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };
  const { client, currency, service, payment } = parsed.input;
  const recorded = payment.submissionKey && (await repo.paymentByKey(payment.submissionKey));
  if (recorded) redirect(`/admin/invoices/${recorded}?notice=receipt`);
  const settings = await SettingsRepository.load();
  const taxRateBp = settings.vat.registered ? settings.vat.rateBp : 0;
  // ponytail: the net price is rounded to the fil, so with VAT the receipt total can differ from the typed amount by 0.01.
  const unitMinor = Math.round((payment.amountMinor * 10_000) / (10_000 + taxRateBp));
  const input = applyVat(
    {
      docType: "receipt",
      relatedId: null,
      bookingUid: null,
      ...client,
      clientAddress: "",
      currency,
      items: [{ description: service, unit: "session", quantity: 1, unitMinor, amountMinor: unitMinor }],
      discountMinor: 0,
      taxRateBp,
      trn: "",
      dueDate: payment.paidOn,
      notes: "",
      paymentInstructions: "",
      bankAccountId: null,
      paymentTerms: "upfront",
      termsDays: null,
      paymentLink: "",
      layout: "standard",
      sections: NO_SECTIONS,
      recurring: false,
    },
    settings,
  );
  const id = await repo.createDraft(input, null, actor);
  const error = await issueDocument(repo, id, settings, actor);
  if (error) return { message: `Saved as a draft, not issued: ${error}` };
  const total = InvoiceMath.totals([unitMinor], 0, input.taxRateBp).totalMinor;
  const result = await repo.addPayment(id, { ...payment, amountMinor: total, proofUrl: null }, actor);
  if (result) await repo.completeReceipt(id, result.paymentId);
  // Lost a race with the same form sent twice: void this copy (its number stays used) and open the first.
  const first = !result && payment.submissionKey ? await repo.paymentByKey(payment.submissionKey) : null;
  if (first) {
    await repo.voidQuickReceipt(id, actor);
    redirect(`/admin/invoices/${first}?notice=receipt`);
  }
  redirect(`/admin/invoices/${id}?notice=receipt`);
}

/** Emails a branded session confirmation (never automatic: Cal.com already confirms website bookings). */
export async function sendConfirmation(_state: ConfirmationFormState, formData: FormData): Promise<ConfirmationFormState> {
  const { repo } = await session();
  const parsed = InvoiceContract.parseConfirmation(Object.fromEntries(formData));
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };
  const resend = ResendClient.fromEnv();
  if (!resend) return { message: NO_EMAIL };

  const message = InvoiceEmails.confirmation(parsed.input);
  let providerId: string;
  try {
    providerId = await resend.send(parsed.input.clientEmail, message);
  } catch (error) {
    if (error instanceof ApiError) return { message: `Not sent: ${error.message}` };
    throw error;
  }
  await repo.logEmail({
    kind: "confirmation",
    toEmail: parsed.input.clientEmail,
    subject: message.subject,
    invoiceId: null,
    bookingUid: parsed.input.bookingUid,
    providerId,
  });
  return { sentTo: parsed.input.clientEmail };
}
