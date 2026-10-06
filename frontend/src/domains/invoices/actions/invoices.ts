"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError } from "@/core/http/ApiError";
import { ResendClient } from "@/core/email/ResendClient";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { BankAccountRepository } from "../server/BankAccountRepository";
import { ClientRepository } from "../server/ClientRepository";
import { InvoiceRepository } from "../server/InvoiceRepository";
import { InvoiceContract, type ConfirmationFieldErrors, type InvoiceFieldErrors } from "../services/InvoiceContract";
import { InvoiceEmails } from "../services/InvoiceEmails";
import { InvoiceMath } from "../services/InvoiceMath";
import type { BankDetails, Invoice, InvoiceInput } from "../types";

/**
 * Admin invoice and confirmation actions. Each one re-checks the session:
 * server actions are public POST endpoints regardless of which page renders them.
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

const NO_EMAIL = "Email is not configured (RESEND_API_KEY, EMAIL_FROM).";

async function repository(): Promise<InvoiceRepository> {
  await AdminAuth.require();
  const repo = InvoiceRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

/** Origin of this request, for the public invoice link in emails. */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Server-side links for a parsed invoice: checks the saved client exists (or
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

/** Emails an issued invoice and logs it. Returns an error message, or null when sent. */
async function emailInvoice(repo: InvoiceRepository, invoice: Invoice): Promise<string | null> {
  const resend = ResendClient.fromEnv();
  if (!resend) return NO_EMAIL;
  if (!invoice.clientEmail) return "This invoice has no client email. Share it on WhatsApp instead.";
  const message = InvoiceEmails.invoice(invoice, `${await origin()}/invoice/${invoice.token}`);
  let providerId: string;
  try {
    providerId = await resend.send(invoice.clientEmail, message);
  } catch (error) {
    if (error instanceof ApiError) return error.message;
    throw error;
  }
  await repo.logEmail({
    kind: "invoice",
    toEmail: invoice.clientEmail,
    subject: message.subject,
    invoiceId: invoice.id,
    bookingUid: invoice.bookingUid,
    providerId,
  });
  return null;
}

/**
 * Save a draft; with intent "issue" also assign its number (freezing it), and
 * with "send" email it too. A failed email leaves the invoice issued: the
 * detail page offers to resend.
 */
export async function saveInvoice(_state: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const repo = await repository();
  const parsed = InvoiceContract.parseInvoice(Object.fromEntries(formData));
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };

  const intent = formData.get("intent");
  if (intent === "send" && !ResendClient.fromEnv()) return { message: NO_EMAIL };
  if (intent === "send" && !parsed.input.clientEmail) return { message: "Add the client's email to send it, or issue it and share it on WhatsApp." };

  const resolved = await resolveLinks(parsed.input, formData.get("saveClient") === "on");
  if (typeof resolved === "string") return { message: resolved };

  let id = formData.get("id");
  if (typeof id === "string" && id) {
    if (!(await repo.updateDraft(id, resolved.input, resolved.bank))) return { message: "This invoice was already issued or deleted." };
  } else {
    id = await repo.createDraft(resolved.input, resolved.bank);
  }

  let notice = "saved";
  if (intent === "issue" || intent === "send") {
    if (!(await repo.issue(id))) return { message: "This invoice was already issued." };
    notice = "issued";
    if (intent === "send") {
      const invoice = await repo.byId(id);
      const error = invoice && (await emailInvoice(repo, invoice));
      notice = error ? "email-failed" : "emailed";
      if (error) console.error(`Invoice email failed for ${id}: ${error}`);
    }
  }
  redirect(`/admin/invoices/${id}?notice=${notice}`);
}

export async function resendInvoice(formData: FormData): Promise<void> {
  const repo = await repository();
  const invoice = await repo.byId(String(formData.get("id")));
  if (!invoice || invoice.status !== "sent") return;
  const error = await emailInvoice(repo, invoice);
  if (error) console.error(`Invoice email failed for ${invoice.id}: ${error}`);
  redirect(`/admin/invoices/${invoice.id}?notice=${error ? "email-failed" : "emailed"}`);
}

export async function markInvoicePaid(formData: FormData): Promise<void> {
  const repo = await repository();
  const id = String(formData.get("id"));
  await repo.markPaid(id);
  redirect(`/admin/invoices/${id}`);
}

/** An advance or part payment; the one that clears the balance marks the invoice paid. */
export async function recordInvoicePayment(formData: FormData): Promise<void> {
  const repo = await repository();
  const id = String(formData.get("id"));
  const payment = InvoiceContract.parsePayment(Object.fromEntries(formData));
  const result = typeof payment === "string" ? null : await repo.addPayment(id, payment);
  redirect(`/admin/invoices/${id}?notice=${result === "settled" ? "paid" : result ? "payment" : "payment-refused"}`);
}

export async function removeInvoicePayment(formData: FormData): Promise<void> {
  const repo = await repository();
  const id = String(formData.get("id"));
  await repo.removePayment(id, String(formData.get("paymentId")));
  redirect(`/admin/invoices/${id}?notice=payment-removed`);
}

export async function voidInvoice(formData: FormData): Promise<void> {
  const repo = await repository();
  const id = String(formData.get("id"));
  await repo.void(id);
  redirect(`/admin/invoices/${id}`);
}

/** A new draft from an existing invoice. The bank snapshot is copied as is; saving the draft refreshes it from the account. */
async function copyAsDraft(repo: InvoiceRepository, source: Invoice, nextMonth: boolean): Promise<string> {
  const roll = (text: string) => (nextMonth ? InvoiceMath.nextMonthText(text) : text);
  return repo.createDraft(
    {
      bookingUid: nextMonth ? null : source.bookingUid,
      clientId: source.clientId,
      clientName: source.clientName,
      clientEmail: source.clientEmail,
      clientPhone: source.clientPhone,
      clientAddress: source.clientAddress,
      currency: source.currency,
      items: source.items.map((item) => ({ ...item, description: roll(item.description), ...(item.detail && { detail: roll(item.detail) }) })),
      discountMinor: source.discountMinor,
      taxRateBp: source.taxRateBp,
      trn: source.trn,
      dueDate: nextMonth ? InvoiceMath.addMonths(source.dueDate, 1) : source.dueDate,
      notes: source.notes,
      paymentInstructions: source.paymentInstructions,
      bankAccountId: source.bankAccountId,
    },
    source.bank,
  );
}

/** New draft with the same client, items and terms (the way to "edit" an issued invoice). */
export async function duplicateInvoice(formData: FormData): Promise<void> {
  const repo = await repository();
  const source = await repo.byId(String(formData.get("id")));
  if (!source) return;
  redirect(`/admin/invoices/${await copyAsDraft(repo, source, false)}?notice=duplicated`);
}

/** Next month's invoice for a monthly client: same lines, due a month later, month names moved on. */
export async function copyInvoiceForNextMonth(formData: FormData): Promise<void> {
  const repo = await repository();
  const source = await repo.byId(String(formData.get("id")));
  if (!source) return;
  redirect(`/admin/invoices/${await copyAsDraft(repo, source, true)}?notice=next-month`);
}

export async function deleteDraftInvoice(formData: FormData): Promise<void> {
  const repo = await repository();
  await repo.deleteDraft(String(formData.get("id")));
  redirect("/admin/invoices");
}

/** Emails a branded session confirmation (never automatic: Cal.com already confirms website bookings). */
export async function sendConfirmation(_state: ConfirmationFormState, formData: FormData): Promise<ConfirmationFormState> {
  const repo = await repository();
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
