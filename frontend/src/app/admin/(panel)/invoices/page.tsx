import type { Metadata } from "next";
import Link from "next/link";

import { ResendClient } from "@/core/email/ResendClient";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { createRecurringDrafts } from "@/domains/invoices/actions/invoices";
import { badgeFor, EmailHistory, EmailNotConfigured, formatDubai, StatusBadge } from "@/domains/invoices/components/AdminBits";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import type { DocumentType } from "@/domains/invoices/types";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";

export const metadata: Metadata = { title: "Billing" };

const TABS: [DocumentType | null, string][] = [
  [null, "All"],
  ["invoice", "Invoices"],
  ["quote", "Quotes"],
  ["receipt", "Receipts"],
  ["credit_note", "Credit notes"],
];
const LINK = "h-10 rounded-md border border-line px-4 py-2 text-sm text-muted hover:text-ink";

/** Every billing document, newest first, filtered by type with `?type=`. */
export default async function AdminInvoicesPage({ searchParams }: PageProps<"/admin/invoices">) {
  await AdminAuth.requireOwner();
  const repo = InvoiceRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const query = await searchParams;
  const type = InvoiceContract.DOC_TYPES.find((t) => t === query.type) ?? null;
  const [documents, emails, recurring] = await Promise.all([repo.list({ docType: type ?? undefined }), repo.emails(), repo.recurringDue()]);
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">Billing</h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/invoices/banks" className={LINK}>
            Bank accounts
          </Link>
          <Link href="/admin/invoices/confirm" className={LINK}>
            Send a confirmation
          </Link>
          <Link href="/admin/invoices/receipt" className={LINK}>
            Quick receipt
          </Link>
          <Link href="/admin/invoices/new?type=quote" className={LINK}>
            New quote
          </Link>
          <Link href="/admin/invoices/new" className="h-10 rounded-md bg-quant/15 px-4 py-2 text-sm font-medium text-quant hover:bg-quant/25">
            New invoice
          </Link>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        Drafts stay private. Issuing assigns the next number for its type and freezes the document; corrections are a void and a new draft, or a credit note.
      </p>
      {query.notice === "recurring" && (
        <p role="status" className="mt-4 text-sm text-quant">
          {Number(query.count) > 0
            ? `${query.count} draft${query.count === "1" ? "" : "s"} created. Review and issue each one.`
            : "Nothing to create: every recurring invoice already has this month’s draft."}
        </p>
      )}
      {recurring.length > 0 && (
        <form action={createRecurringDrafts} className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-gold/40 bg-gold/5 px-4 py-3 text-sm">
          <span className="text-gold">
            {recurring.length} recurring invoice{recurring.length === 1 ? "" : "s"} due for this month: {recurring.map((r) => r.clientName).join(", ")}.
          </span>
          <PendingButton pendingLabel="Creating…" className="h-9 rounded-md bg-gold px-3 text-sm font-medium text-canvas hover:bg-gold-bright">
            Create this month’s drafts
          </PendingButton>
        </form>
      )}
      {!ResendClient.fromEnv() && (
        <div className="mt-6">
          <EmailNotConfigured />
        </div>
      )}

      <nav aria-label="Document types" className="mt-8 flex flex-wrap gap-1 border-b border-line">
        {TABS.map(([value, name]) => (
          <Link
            key={name}
            href={value ? `/admin/invoices?type=${value}` : "/admin/invoices"}
            aria-current={value === type ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${value === type ? "border-quant text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {name}
          </Link>
        ))}
      </nav>

      {documents.length === 0 ? (
        <p className="mt-10 text-muted">Nothing here yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-[0.18em] text-muted uppercase">
                <th className="py-2 pr-4 font-normal">Number</th>
                <th className="py-2 pr-4 font-normal">Type</th>
                <th className="py-2 pr-4 font-normal">Client</th>
                <th className="py-2 pr-4 text-right font-normal">Total</th>
                <th className="py-2 pr-4 font-normal">Due</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 pr-4 font-normal">Emailed</th>
                <th className="py-2 font-normal">Viewed</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-line/60 hover:bg-surface/60">
                  <td className="py-2.5 pr-4 font-mono">
                    <Link href={`/admin/invoices/${doc.id}`} className="text-quant hover:underline">
                      {doc.number ?? "Draft"}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 text-muted">{SettingsContract.DOCUMENT_TYPES[doc.docType]}</td>
                  <td className="py-2.5 pr-4">{doc.clientName}</td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{InvoiceMath.money(doc.totalMinor, doc.currency)}</td>
                  <td className="py-2.5 pr-4 text-muted">{doc.docType === "invoice" || doc.docType === "quote" ? InvoiceEmails.day(doc.dueDate) : "—"}</td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={badgeFor(doc, today)} />
                  </td>
                  <td className="py-2.5 pr-4 text-muted">{doc.lastEmailedAt ? formatDubai(doc.lastEmailedAt) : "—"}</td>
                  <td className="py-2.5 text-muted">{doc.firstViewedAt ? formatDubai(doc.firstViewedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-12 mb-4 text-lg">Recent emails</h2>
      <EmailHistory entries={emails} />
    </div>
  );
}
