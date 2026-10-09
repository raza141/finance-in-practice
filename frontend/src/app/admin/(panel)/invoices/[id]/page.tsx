import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { siteConfig } from "@/core/config/site";
import { ResendClient } from "@/core/email/ResendClient";
import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import {
  acceptQuote,
  convertQuote,
  declineQuote,
  reviseQuote,
  withdrawAcceptance,
  copyInvoiceForNextMonth,
  createCreditNote,
  deleteDraftInvoice,
  duplicateInvoice,
  markInvoicePaid,
  recordInvoicePayment,
  removeInvoicePayment,
  renewLink,
  resendInvoice,
  voidInvoice,
} from "@/domains/invoices/actions/invoices";
import { badgeFor, EmailNotConfigured, formatDubai, StatusBadge } from "@/domains/invoices/components/AdminBits";
import { DocumentView } from "@/domains/invoices/components/DocumentView";
import { InvoiceForm } from "@/domains/invoices/components/InvoiceForm";
import { SharePanel } from "@/domains/invoices/components/SharePanel";
import { InvoiceFormLoader } from "@/domains/invoices/server/InvoiceFormLoader";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { IssueChecks } from "@/domains/invoices/server/IssueChecks";
import { DocumentAccess } from "@/domains/invoices/services/DocumentAccess";
import { DocumentFormat } from "@/domains/invoices/services/DocumentFormat";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";

export const metadata: Metadata = { title: "Document" };

const NOTICES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  saved: { text: "Draft saved.", tone: "ok" },
  issued: { text: "Issued. Share it below.", tone: "ok" },
  "issue-failed": { text: "Not issued.", tone: "warn" },
  emailed: { text: "Emailed to the client.", tone: "ok" },
  "email-failed": { text: "Issued, but the email could not be sent. Check the email settings and use “Email again”.", tone: "warn" },
  duplicated: { text: "Copied into a new draft. Edit it and issue it when ready.", tone: "ok" },
  "next-month": { text: "Next month’s draft is ready: due date and months moved on. Check it, then issue it.", tone: "ok" },
  "from-quote": { text: "Invoice drafted from the accepted quote. Check it, then issue it.", tone: "ok" },
  "quote-invoiced": { text: "This quote already has an invoice: here it is. Void it first to convert the quote again.", tone: "warn" },
  "credit-draft": { text: "Credit note drafted with the invoice’s lines. Edit them down to the amount credited, then issue it.", tone: "ok" },
  receipt: { text: "Receipt issued and payment recorded. Share it below.", tone: "ok" },
  payment: { text: "Payment recorded and a receipt issued. The invoice stays open until the balance is paid.", tone: "ok" },
  paid: { text: "Payment recorded and a receipt issued: the invoice is now paid in full.", tone: "ok" },
  "confirm-needed": { text: "Not issued yet.", tone: "warn" },
  accepted: { text: "Acceptance recorded. Convert it to an invoice when ready.", tone: "ok" },
  "accept-refused": { text: "Acceptance not recorded.", tone: "warn" },
  "answer-refused": { text: "Not changed.", tone: "warn" },
  withdrawn: { text: "Acceptance withdrawn: the quote is open again.", tone: "ok" },
  revision: { text: "Revision drafted. Issuing it supersedes the earlier quote; it needs its own acceptance.", tone: "ok" },
  "revision-exists": { text: "This quote already has a revision: here it is.", tone: "warn" },
  "payment-duplicate": { text: "That payment was already recorded (the form was sent twice): nothing was added.", tone: "warn" },
  "payment-refused": { text: "Payment not recorded: enter an amount up to the balance due, and the date it arrived.", tone: "warn" },
  "payment-removed": { text: "Payment removed and its receipt voided.", tone: "ok" },
  "link-renewed": { text: "Client link renewed for 90 days. Share it again below.", tone: "ok" },
  "link-emailed": { text: "Client link renewed for 90 days and emailed.", tone: "ok" },
};

const BUTTON = "h-9 rounded-md border border-line px-3 text-sm text-muted transition-colors hover:text-ink";
const PRIMARY = "h-9 rounded-md bg-quant/15 px-3 text-sm font-medium text-quant hover:bg-quant/25";

/** One action button posting the document id. */
function Action({ action, label, pending, className = BUTTON, extra }: { action: (data: FormData) => Promise<void>; label: string; pending: string; className?: string; extra?: Record<string, string> }) {
  return (
    <form action={action}>
      {Object.entries(extra ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <PendingButton pendingLabel={pending} className={className}>
        {label}
      </PendingButton>
    </form>
  );
}

/** Now in Dubai as a datetime-local value, "YYYY-MM-DDTHH:mm". */
function dubaiNow(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: InvoiceContract.DEFAULT_TIME_ZONE, dateStyle: "short", timeStyle: "short" }).format(new Date()).replace(" ", "T");
}

export default async function DocumentPage({ params, searchParams }: PageProps<"/admin/invoices/[id]">) {
  await AdminAuth.requireOwner();
  const repo = InvoiceRepository.fromEnv();
  const doc = await repo?.byId((await params).id);
  if (!repo || !doc) notFound();
  const query = await searchParams;
  const notice = NOTICES[String(query.notice)];
  const reason = typeof query.reason === "string" ? query.reason : null;
  const emailEnabled = ResendClient.fromEnv() !== null;
  const [events, related, options, settings, warnings, revisionId] = await Promise.all([
    repo.events(doc.id),
    repo.related(doc.id),
    doc.status === "draft" ? InvoiceFormLoader.options(doc.items) : null,
    SettingsRepository.load(),
    doc.status === "draft" ? IssueChecks.for(repo, doc.id, doc) : IssueChecks.NONE,
    doc.docType === "quote" && doc.status !== "draft" ? repo.revisionOf(doc.id) : null,
  ]);
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const money = (minor: number) => InvoiceMath.money(minor, doc.currency);
  const balance = DocumentFormat.balance(doc);
  const label = SettingsContract.DOCUMENT_TYPES[doc.docType];
  const isInvoice = doc.docType === "invoice";
  const isQuickReceipt = doc.docType === "receipt" && !doc.relatedId;
  const id = { id: doc.id };
  const url = `${siteConfig.url}/invoice/${doc.token}`;
  const expires = DocumentAccess.expiresAt(doc);
  const quoteInvoice = doc.docType === "quote" ? related.find((r) => r.docType === "invoice" && r.status !== "void") : undefined;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/invoices" className="text-sm text-muted hover:text-ink">
        ← Billing
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">{doc.number ?? `Draft ${label.toLowerCase()}`}</h1>
        <span className="font-mono text-xs tracking-wider text-muted uppercase">{label}</span>
        <StatusBadge status={badgeFor(doc, today)} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {doc.clientName} · created {formatDubai(doc.createdAt)}
        {doc.sentAt && ` · issued ${formatDubai(doc.sentAt)}`}
        {doc.paidAt && doc.docType === "invoice" && ` · paid ${formatDubai(doc.paidAt)}`}
        {doc.voidedAt && ` · voided ${formatDubai(doc.voidedAt)}`}
        {doc.status !== "draft" &&
          (doc.firstViewedAt && doc.lastViewedAt
            ? ` · viewed by client ${doc.viewCount}× (first ${formatDubai(doc.firstViewedAt)}, last ${formatDubai(doc.lastViewedAt)})`
            : " · not opened by the client yet")}
      </p>
      {doc.supersedesId && (
        <p className="mt-1 text-sm text-muted">
          Revision of{" "}
          <Link href={`/admin/invoices/${doc.supersedesId}`} className="font-mono text-quant hover:underline">
            {doc.supersedesNumber ?? "an earlier quote"}
          </Link>
        </p>
      )}
      {revisionId && (
        <p className="mt-1 text-sm text-muted">
          Revised:{" "}
          <Link href={`/admin/invoices/${revisionId}`} className="text-quant hover:underline">
            open the revision
          </Link>
        </p>
      )}
      {doc.relatedId && doc.relatedNumber && (
        <p className="mt-1 text-sm text-muted">
          {doc.docType === "credit_note" ? "Credits invoice" : doc.docType === "receipt" ? "Receipt for invoice" : "From quote"}{" "}
          <Link href={`/admin/invoices/${doc.relatedId}`} className="font-mono text-quant hover:underline">
            {doc.relatedNumber}
          </Link>
        </p>
      )}

      <div className="mt-6 grid gap-3">
        {notice && (
          <p role="status" className={`text-sm ${notice.tone === "ok" ? "text-quant" : "text-gold"}`}>
            {notice.text}
            {reason && ` ${reason}`}
          </p>
        )}
        {query.proof === "lost" && (
          <p role="alert" className="text-sm text-gold">
            The proof file was not kept: payment proofs need a private Vercel Blob store (the current one is public). The payment itself is recorded.
          </p>
        )}
        {!emailEnabled && doc.status !== "void" && <EmailNotConfigured />}
      </div>

      {doc.status === "draft" && options ? (
        <>
          <div className="mt-8">
            <InvoiceForm key={doc.id} id={doc.id} initial={doc} options={options} emailEnabled={emailEnabled} submissionKey={randomUUID()} warnings={warnings} />
          </div>
          <div className="mt-10">
            <Action action={deleteDraftInvoice} extra={id} label="Delete this draft" pending="Deleting…" className="text-sm text-red-300/90 hover:underline" />
          </div>
        </>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {isInvoice && doc.status === "sent" && (
              <Action action={markInvoicePaid} extra={id} label={settledLabel(doc.paidMinor + doc.creditedMinor > 0, money(balance))} pending="Saving…" className={PRIMARY} />
            )}
            {isInvoice && (doc.status === "sent" || doc.status === "paid") && DocumentFormat.creditable(doc) > 0 && (
              <Action action={createCreditNote} extra={id} label="Credit note" pending="Drafting…" />
            )}
            {doc.docType === "quote" && doc.status === "accepted" && !quoteInvoice && (
              <Action action={convertQuote} extra={id} label="Convert to invoice" pending="Converting…" className={PRIMARY} />
            )}
            {quoteInvoice && (
              <Link href={`/admin/invoices/${quoteInvoice.id}`} className={`${PRIMARY} inline-flex items-center`}>
                Open invoice {quoteInvoice.number ?? "draft"}
              </Link>
            )}
            {doc.docType === "quote" && ["sent", "accepted", "declined"].includes(doc.status) && !quoteInvoice && !revisionId && (
              <Action action={reviseQuote} extra={id} label="Revise quote" pending="Drafting…" />
            )}
            {isInvoice && <Action action={copyInvoiceForNextMonth} extra={id} label="Copy for next month" pending="Copying…" />}
            {(isInvoice || doc.docType === "quote") && <Action action={duplicateInvoice} extra={id} label="Duplicate as draft" pending="Copying…" />}
          </div>

          {doc.status !== "void" && (
            <SharePanel
              documentId={doc.id}
              pdfHref={`/admin/invoice-pdf/${doc.id}`}
              whatsappHref={InvoiceEmails.whatsapp(doc, url, settings)}
              whatsappText={InvoiceEmails.whatsappText(doc, url, settings)}
              phone={doc.clientPhone}
              emailForms={
                <>
                  {emailEnabled && doc.clientEmail && <Action action={resendInvoice} extra={id} label={events.some((e) => e.detail.startsWith("email to")) ? "Email again" : "Email"} pending="Sending…" />}
                  <Action action={renewLink} extra={id} label="Resend link" pending="Renewing…" />
                </>
              }
            />
          )}
          <p className="mt-3 text-xs text-muted">
            Client link (private, share only with {doc.clientEmail || doc.clientName}): <code className="break-all text-ink/80">/invoice/{doc.token}</code>
            {expires ? ` · works until ${formatDubai(expires)}` : " · works until settled, then 30 more days"}
          </p>

          {isInvoice && doc.status !== "void" && (
            <section className="mt-8 rounded-lg border border-line p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-lg">Payments</h2>
                <p className="font-mono text-sm text-muted">
                  Paid {money(doc.paidMinor)}
                  {doc.creditedMinor > 0 && ` · credited ${money(doc.creditedMinor)}`} of {money(doc.totalMinor)} · <span className="text-ink">Balance {money(balance)}</span>
                </p>
              </div>
              {doc.payments.length > 0 && (
                <ul className="mt-4 divide-y divide-line/60 text-sm">
                  {doc.payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                      <span className="w-28 text-muted">{InvoiceEmails.day(payment.paidOn)}</span>
                      <span className="flex-1">
                        {payment.note || "Payment"} · {InvoiceContract.PAYMENT_METHODS[payment.method]}
                        {payment.reference && <span className="text-muted"> · ref {payment.reference}</span>}
                      </span>
                      <span className="font-mono tabular-nums">{money(payment.amountMinor)}</span>
                      {payment.proofUrl && (
                        <a href={`/admin/payment-proof/${payment.id}`} target="_blank" rel="noreferrer" className="text-xs text-quant hover:underline">
                          Proof
                        </a>
                      )}
                      {payment.receiptId && (
                        <Link href={`/admin/invoices/${payment.receiptId}`} className="text-xs text-quant hover:underline">
                          Receipt
                        </Link>
                      )}
                      <Action action={removeInvoicePayment} extra={{ ...id, paymentId: payment.id }} label="Remove" pending="Removing…" className="text-xs text-red-300/90 hover:underline" />
                    </li>
                  ))}
                </ul>
              )}
              {doc.status === "sent" && balance > 0 && (
                <form action={recordInvoicePayment} className="mt-4 grid items-end gap-3 sm:grid-cols-3">
                  <input type="hidden" name="id" value={doc.id} />
                  <input type="hidden" name="submissionKey" value={randomUUID()} />
                  <label className="text-xs text-muted">
                    Amount ({doc.currency})
                    <input name="amount" inputMode="decimal" required defaultValue={InvoiceMath.majorInput(balance)} className={`${FIELD} mt-1`} />
                  </label>
                  <label className="text-xs text-muted">
                    Received on
                    <input name="paidOn" type="date" required defaultValue={today} className={`${FIELD} mt-1`} />
                  </label>
                  <label className="text-xs text-muted">
                    Method
                    <select name="method" defaultValue="bank" className={`${FIELD} mt-1`}>
                      {Object.entries(InvoiceContract.PAYMENT_METHODS).map(([value, name]) => (
                        <option key={value} value={value}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-muted">
                    Reference (optional)
                    <input name="reference" maxLength={80} placeholder="Transfer or provider reference" className={`${FIELD} mt-1`} />
                  </label>
                  <label className="text-xs text-muted">
                    Note (optional)
                    <input name="note" maxLength={80} placeholder="Advance, or Balance at session end" className={`${FIELD} mt-1`} />
                  </label>
                  <label className="text-xs text-muted">
                    Proof (optional)
                    <input name="proof" type="file" accept="image/*,application/pdf" className={`${FIELD} mt-1 text-xs`} />
                  </label>
                  <PendingButton pendingLabel="Saving…" className={`${BUTTON} sm:col-span-3 sm:justify-self-start`}>
                    Record payment and issue receipt
                  </PendingButton>
                </form>
              )}
            </section>
          )}

          {doc.docType === "quote" && (doc.status === "sent" || doc.acceptance) && (
            <section className="mt-8 rounded-lg border border-line p-5">
              <h2 className="text-lg">Client approval</h2>
              {doc.acceptance ? (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
                  <dt className="text-muted">Accepted</dt>
                  <dd>{formatDubai(doc.acceptance.acceptedAt)}</dd>
                  <dt className="text-muted">By</dt>
                  <dd>{doc.acceptance.approver}</dd>
                  <dt className="text-muted">How</dt>
                  <dd>{InvoiceContract.APPROVAL_METHODS[doc.acceptance.method]}</dd>
                  {doc.acceptance.notes && (
                    <>
                      <dt className="text-muted">Notes</dt>
                      <dd className="whitespace-pre-line">{doc.acceptance.notes}</dd>
                    </>
                  )}
                  {doc.acceptance.evidenceUrl && (
                    <>
                      <dt className="text-muted">Evidence</dt>
                      <dd className="break-all">
                        {/* A pointer to the evidence, never fetched or previewed here. */}
                        <a href={doc.acceptance.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-quant hover:underline">
                          {doc.acceptance.evidenceUrl}
                        </a>
                      </dd>
                    </>
                  )}
                  <dt className="text-muted">Recorded</dt>
                  <dd className="text-muted">
                    {doc.acceptance.recordedBy}, {formatDubai(doc.acceptance.recordedAt)}
                  </dd>
                </dl>
              ) : DocumentFormat.isExpired(doc, today) ? (
                <p className="mt-2 text-sm text-muted">Expired on {InvoiceEmails.day(doc.dueDate)}. Revise it to send an updated quote, or record that it was declined.</p>
              ) : (
                <form action={acceptQuote} className="mt-4 grid items-end gap-3 sm:grid-cols-3">
                  <input type="hidden" name="id" value={doc.id} />
                  <label className="text-xs text-muted">
                    Accepted on (Dubai time)
                    <input name="acceptedAt" type="datetime-local" required defaultValue={dubaiNow()} max={dubaiNow()} className={`${FIELD} mt-1`} />
                  </label>
                  <label className="text-xs text-muted">
                    Accepted by
                    <input name="approver" required maxLength={120} defaultValue={doc.clientName} className={`${FIELD} mt-1`} />
                  </label>
                  <label className="text-xs text-muted">
                    How
                    <select name="method" defaultValue="whatsapp" className={`${FIELD} mt-1`}>
                      {Object.entries(InvoiceContract.APPROVAL_METHODS).map(([value, name]) => (
                        <option key={value} value={value}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-muted sm:col-span-3">
                    Evidence link (optional)
                    <input name="evidenceUrl" type="url" maxLength={500} placeholder="https:// link to the email, signed copy or chat export" className={`${FIELD} mt-1`} />
                  </label>
                  <label className="text-xs text-muted sm:col-span-3">
                    Notes (optional)
                    <textarea name="notes" rows={2} maxLength={1000} placeholder="e.g. Confirmed on WhatsApp, screenshot saved" className={`${FIELD} mt-1 resize-y`} />
                  </label>
                  <PendingButton pendingLabel="Saving…" className={`${PRIMARY} sm:col-span-3 sm:justify-self-start`}>
                    Record acceptance
                  </PendingButton>
                  <p className="text-xs text-muted sm:col-span-3">A link is a pointer to your evidence, not proof by itself. The acceptance applies to this quote exactly as issued.</p>
                </form>
              )}
              {(doc.status === "sent" || (doc.status === "accepted" && !quoteInvoice)) && (
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm text-muted">{doc.status === "sent" ? "Client declined…" : "Withdraw this acceptance…"}</summary>
                  <form action={doc.status === "sent" ? declineQuote : withdrawAcceptance} className="mt-3 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="id" value={doc.id} />
                    <label className="flex-1 text-xs text-muted">
                      Reason (kept in the history)
                      <input name="reason" required maxLength={300} className={`${FIELD} mt-1`} />
                    </label>
                    <PendingButton pendingLabel="Saving…" className={BUTTON}>
                      {doc.status === "sent" ? "Mark declined" : "Withdraw acceptance"}
                    </PendingButton>
                  </form>
                </details>
              )}
            </section>
          )}

          {related.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg">Linked documents</h2>
              <ul className="mt-3 divide-y divide-line/60 text-sm">
                {related.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-4 py-2">
                    <Link href={`/admin/invoices/${r.id}`} className="font-mono text-quant hover:underline">
                      {r.number ?? "Draft"}
                    </Link>
                    <span className="text-muted">{SettingsContract.DOCUMENT_TYPES[r.docType]}</span>
                    <span className="font-mono tabular-nums">{InvoiceMath.money(r.totalMinor, r.currency)}</span>
                    <StatusBadge status={badgeFor(r, today)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-8 rounded-lg bg-slate-200 p-4 sm:p-6">
            <DocumentView doc={doc} settings={settings} />
          </div>

          {doc.status === "sent" && doc.paidMinor > 0 && !isQuickReceipt && (
            <p className="mt-10 text-xs text-muted">This document has payments, so it can’t be voided. Correct it with a credit note.</p>
          )}
          {(doc.status === "sent" || doc.status === "accepted" || (isQuickReceipt && doc.status === "paid")) && (doc.paidMinor === 0 || isQuickReceipt) && (
            <details className="mt-10 rounded-lg border border-red-400/30 p-5">
              <summary className="text-sm text-red-300/90">Void this {label.toLowerCase()}…</summary>
              <p className="mt-3 text-sm text-muted">
                The number stays used and the client link shows it as void.
                {isQuickReceipt ? " Its payment is removed too." : " Duplicate it first if a corrected version is needed."}
              </p>
              <div className="mt-4">
                <Action action={voidInvoice} extra={id} label={`Void ${label.toLowerCase()}`} pending="Voiding…" className="h-10 rounded-md border border-red-400/50 px-4 text-sm text-red-300 hover:bg-red-400/10" />
              </div>
            </details>
          )}
        </>
      )}

      <h2 className="mt-12 mb-4 text-lg">History</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted">Nothing recorded yet.</p>
      ) : (
        <ol className="grid gap-1.5 text-sm">
          {events.map((event, index) => (
            <li key={index} className="flex flex-wrap gap-x-3">
              <span className="w-44 font-mono text-xs text-muted">{formatDubai(event.at)}</span>
              <span className="text-ink">{event.event}</span>
              {event.detail && <span className="text-muted">{event.detail}</span>}
              <span className="text-muted/70">· {event.actor}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const settledLabel = (partly: boolean, balance: string) => (partly ? `Mark fully paid (${balance})` : "Mark as paid");
