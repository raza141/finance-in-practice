import type { Metadata } from "next";
import Link from "next/link";

import { ResendClient } from "@/core/email/ResendClient";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { EmailHistory, EmailNotConfigured, formatDubai, StatusBadge } from "@/domains/invoices/components/AdminBits";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";

export const metadata: Metadata = { title: "Invoices" };

export default async function AdminInvoicesPage() {
  await AdminAuth.require();
  const repo = InvoiceRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const [invoices, emails] = await Promise.all([repo.list(), repo.emails()]);
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">Invoices</h1>
        <div className="flex gap-3">
          <Link href="/admin/invoices/banks" className="h-10 rounded-md border border-line px-4 py-2 text-sm text-muted hover:text-ink">
            Bank accounts
          </Link>
          <Link href="/admin/invoices/confirm" className="h-10 rounded-md border border-line px-4 py-2 text-sm text-muted hover:text-ink">
            Send a confirmation
          </Link>
          <Link href="/admin/invoices/new" className="h-10 rounded-md bg-quant/15 px-4 py-2 text-sm font-medium text-quant hover:bg-quant/25">
            New invoice
          </Link>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        Drafts stay private. Issuing assigns the next number and freezes the invoice; to change one, void it and duplicate it.
      </p>
      {!ResendClient.fromEnv() && (
        <div className="mt-6">
          <EmailNotConfigured />
        </div>
      )}

      {invoices.length === 0 ? (
        <p className="mt-10 text-muted">No invoices yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-[0.18em] text-muted uppercase">
                <th className="py-2 pr-4 font-normal">Number</th>
                <th className="py-2 pr-4 font-normal">Client</th>
                <th className="py-2 pr-4 text-right font-normal">Total</th>
                <th className="py-2 pr-4 font-normal">Due</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 font-normal">Emailed</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-line/60 hover:bg-surface/60">
                  <td className="py-2.5 pr-4 font-mono">
                    <Link href={`/admin/invoices/${invoice.id}`} className="text-quant hover:underline">
                      {invoice.number ?? "Draft"}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4">{invoice.clientName}</td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{InvoiceMath.money(invoice.totalMinor, invoice.currency)}</td>
                  <td className="py-2.5 pr-4 text-muted">{InvoiceEmails.day(invoice.dueDate)}</td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={invoice.status === "sent" && invoice.dueDate < today ? "overdue" : invoice.status} />
                  </td>
                  <td className="py-2.5 text-muted">{invoice.lastEmailedAt ? formatDubai(invoice.lastEmailedAt) : "—"}</td>
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
