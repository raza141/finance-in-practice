import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { siteConfig } from "@/core/config/site";
import { ResendClient } from "@/core/email/ResendClient";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { copyInvoiceForNextMonth, deleteDraftInvoice, duplicateInvoice, markInvoicePaid, resendInvoice, voidInvoice } from "@/domains/invoices/actions/invoices";
import { EmailHistory, EmailNotConfigured, formatDubai, StatusBadge } from "@/domains/invoices/components/AdminBits";
import { InvoiceDocument } from "@/domains/invoices/components/InvoiceDocument";
import { InvoiceForm } from "@/domains/invoices/components/InvoiceForm";
import { InvoiceFormLoader } from "@/domains/invoices/server/InvoiceFormLoader";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";

export const metadata: Metadata = { title: "Invoice" };

const NOTICES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  saved: { text: "Draft saved.", tone: "ok" },
  issued: { text: "Invoice issued. Share the client link below, or email it.", tone: "ok" },
  emailed: { text: "Invoice emailed to the client.", tone: "ok" },
  "email-failed": { text: "The invoice is issued, but the email could not be sent. Check the email settings and use “Email again”.", tone: "warn" },
  duplicated: { text: "Copied into a new draft. Edit it and issue it when ready.", tone: "ok" },
  "next-month": { text: "Next month’s draft is ready: due date moved a month on, and month names in the lines updated. Check it, then issue it.", tone: "ok" },
};

const BUTTON = "h-9 rounded-md border border-line px-3 text-sm text-muted transition-colors hover:text-ink";

export default async function InvoicePage({ params, searchParams }: PageProps<"/admin/invoices/[id]">) {
  await AdminAuth.require();
  const repo = InvoiceRepository.fromEnv();
  const invoice = await repo?.byId((await params).id);
  if (!repo || !invoice) notFound();
  const notice = NOTICES[String((await searchParams).notice)];
  const emailEnabled = ResendClient.fromEnv() !== null;
  const [emails, options] = await Promise.all([repo.emails(invoice.id), invoice.status === "draft" ? InvoiceFormLoader.options() : null]);

  return (
    <div className="max-w-4xl">
      <Link href="/admin/invoices" className="text-sm text-muted hover:text-ink">
        ← Invoices
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">{invoice.number ?? "Draft invoice"}</h1>
        <StatusBadge status={invoice.status} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {invoice.clientName} · created {formatDubai(invoice.createdAt)}
        {invoice.sentAt && ` · issued ${formatDubai(invoice.sentAt)}`}
        {invoice.paidAt && ` · paid ${formatDubai(invoice.paidAt)}`}
        {invoice.voidedAt && ` · voided ${formatDubai(invoice.voidedAt)}`}
        {invoice.status !== "draft" &&
          (invoice.firstViewedAt && invoice.lastViewedAt
            ? ` · viewed by client ${invoice.viewCount}× (first ${formatDubai(invoice.firstViewedAt)}, last ${formatDubai(invoice.lastViewedAt)})`
            : " · not opened by the client yet")}
      </p>

      <div className="mt-6 grid gap-3">
        {notice && (
          <p role="status" className={`text-sm ${notice.tone === "ok" ? "text-quant" : "text-gold"}`}>
            {notice.text}
          </p>
        )}
        {!emailEnabled && invoice.status !== "void" && invoice.status !== "paid" && <EmailNotConfigured />}
      </div>

      {invoice.status === "draft" && options ? (
        <>
          <div className="mt-8">
            <InvoiceForm key={invoice.id} id={invoice.id} initial={invoice} options={options} emailEnabled={emailEnabled} />
          </div>
          <form action={deleteDraftInvoice} className="mt-10">
            <input type="hidden" name="id" value={invoice.id} />
            <PendingButton pendingLabel="Deleting…" className="text-sm text-red-300/90 hover:underline">
              Delete this draft
            </PendingButton>
          </form>
        </>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {invoice.status === "sent" && (
              <>
                <form action={markInvoicePaid}>
                  <input type="hidden" name="id" value={invoice.id} />
                  <PendingButton pendingLabel="Saving…" className="h-9 rounded-md bg-quant/15 px-3 text-sm font-medium text-quant hover:bg-quant/25">
                    Mark as paid
                  </PendingButton>
                </form>
                {emailEnabled && (
                  <form action={resendInvoice}>
                    <input type="hidden" name="id" value={invoice.id} />
                    <PendingButton pendingLabel="Sending…" className={BUTTON}>
                      {emails.length > 0 ? "Email again" : "Email to client"}
                    </PendingButton>
                  </form>
                )}
              </>
            )}
            <form action={copyInvoiceForNextMonth}>
              <input type="hidden" name="id" value={invoice.id} />
              <PendingButton pendingLabel="Copying…" className={BUTTON}>
                Copy for next month
              </PendingButton>
            </form>
            <form action={duplicateInvoice}>
              <input type="hidden" name="id" value={invoice.id} />
              <PendingButton pendingLabel="Copying…" className={BUTTON}>
                Duplicate as draft
              </PendingButton>
            </form>
            {invoice.status !== "void" && (
              <a
                href={InvoiceEmails.whatsapp(invoice, `${siteConfig.url}/invoice/${invoice.token}`)}
                target="_blank"
                rel="noreferrer"
                title={invoice.clientPhone ? `Opens a chat with ${invoice.clientPhone}` : "No phone on this invoice: WhatsApp will ask which chat"}
                className="inline-flex h-9 items-center rounded-md bg-emerald-500/15 px-3 text-sm font-medium text-emerald-300 hover:bg-emerald-500/25"
              >
                Send on WhatsApp
              </a>
            )}
            <Link href={`/admin/invoice-pdf/${invoice.id}`} target="_blank" className={`${BUTTON} inline-flex items-center`}>
              Download PDF ↓
            </Link>
            <Link href={`/invoice/${invoice.token}`} target="_blank" rel="noreferrer" className="px-2 text-sm text-quant hover:underline">
              Client view ↗
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">
            Client link (private, share only with {invoice.clientEmail}): <code className="break-all text-ink/80">/invoice/{invoice.token}</code>
          </p>

          <div className="mt-8 rounded-lg bg-slate-200 p-4 sm:p-6">
            <InvoiceDocument invoice={invoice} />
          </div>

          {invoice.status === "sent" && (
            <details className="mt-10 rounded-lg border border-red-400/30 p-5">
              <summary className="text-sm text-red-300/90">Void this invoice…</summary>
              <p className="mt-3 text-sm text-muted">
                The number stays used and the client link shows it as void. Duplicate it first if you need a corrected invoice.
              </p>
              <form action={voidInvoice} className="mt-4">
                <input type="hidden" name="id" value={invoice.id} />
                <PendingButton pendingLabel="Voiding…" className="h-10 rounded-md border border-red-400/50 px-4 text-sm text-red-300 hover:bg-red-400/10">
                  Void invoice
                </PendingButton>
              </form>
            </details>
          )}
        </>
      )}

      <h2 className="mt-12 mb-4 text-lg">Emails for this invoice</h2>
      <EmailHistory entries={emails} />
    </div>
  );
}
