import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { deleteClient } from "@/domains/invoices/actions/billing";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { badgeFor, StatusBadge } from "@/domains/invoices/components/AdminBits";
import { ClientForm } from "@/domains/invoices/components/BillingForms";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { Ledger } from "@/domains/invoices/services/Ledger";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";

export const metadata: Metadata = { title: "Client" };

const LEDGER_KIND = { invoice: "Invoice", receipt: "Receipt", credit_note: "Credit note", payment: "Payment for" } as const;

/** Edit a saved client; see their account (running balance), statements and every document. */
export default async function ClientPage({ params }: PageProps<"/admin/clients/[id]">) {
  await AdminAuth.requireOwner();
  const { id } = await params;
  const client = await ClientRepository.fromEnv()?.byId(id);
  if (!client) notFound();
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const invoiceRepo = InvoiceRepository.fromEnv();
  const [invoices, courses, entries] = await Promise.all([
    invoiceRepo?.list({ clientId: client.id }) ?? [],
    CourseRepository.fromEnv()?.all() ?? [],
    invoiceRepo?.ledger(client.id) ?? [],
  ]);
  const ledger = Ledger.running(entries);

  return (
    <div className="max-w-4xl">
      <Link href="/admin/clients" className="text-sm text-muted hover:text-ink">
        ← Clients
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">{client.name}</h1>
        <div className="flex flex-wrap gap-3">
          <Link href={`/admin/invoices/new?client=${client.id}&type=quote`} className="h-10 rounded-md border border-line px-4 py-2 text-sm text-muted hover:text-ink">
            New quote
          </Link>
          <Link href={`/admin/invoices/new?client=${client.id}`} className="h-10 rounded-md bg-quant/15 px-4 py-2 text-sm font-medium text-quant hover:bg-quant/25">
            New invoice
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <ClientForm key={client.id} client={client} courses={courses.map((c) => c.title)} />
      </div>

      <div className="mt-12 mb-4 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-lg">Account</h2>
        <form action={`/admin/statement/${client.id}`} target="_blank" className="flex items-end gap-2">
          <label className="text-xs text-muted">
            Statement for
            <input name="month" type="month" required defaultValue={today.slice(0, 7)} className={`${FIELD} mt-1 py-1.5`} />
          </label>
          <button type="submit" className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
            Statement PDF ↓
          </button>
        </form>
      </div>
      {ledger.length === 0 ? (
        <p className="text-sm text-muted">No issued documents or payments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-[0.18em] text-muted uppercase">
                <th className="py-2 pr-4 font-normal">Date</th>
                <th className="py-2 pr-4 font-normal">Item</th>
                <th className="py-2 pr-4 text-right font-normal">Debit</th>
                <th className="py-2 pr-4 text-right font-normal">Credit</th>
                <th className="py-2 text-right font-normal">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row, index) => (
                <tr key={index} className="border-b border-line/60">
                  <td className="py-2 pr-4 text-muted">{InvoiceEmails.day(row.date)}</td>
                  <td className="py-2 pr-4">
                    {LEDGER_KIND[row.kind]}{" "}
                    <Link href={`/admin/invoices/${row.documentId}`} className="font-mono text-quant hover:underline">
                      {row.number}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums">{row.debitMinor ? InvoiceMath.money(row.debitMinor, row.currency) : ""}</td>
                  <td className="py-2 pr-4 text-right font-mono text-emerald-300 tabular-nums">{row.creditMinor ? InvoiceMath.money(row.creditMinor, row.currency) : ""}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{InvoiceMath.money(row.balanceMinor, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-12 mb-4 text-lg">Documents</h2>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted">No documents for this client yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line text-sm">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
              <Link href={`/admin/invoices/${invoice.id}`} className="font-mono text-quant hover:underline">
                {invoice.number ?? "Draft"}
              </Link>
              <span className="text-muted">{SettingsContract.DOCUMENT_TYPES[invoice.docType]}</span>
              <span className="text-muted">{InvoiceEmails.day(invoice.issueDate ?? invoice.dueDate)}</span>
              <span className="flex-1 text-right font-mono tabular-nums">{InvoiceMath.money(invoice.totalMinor, invoice.currency)}</span>
              <StatusBadge status={badgeFor(invoice, today)} />
            </li>
          ))}
        </ul>
      )}

      <details className="mt-12 rounded-lg border border-red-400/30 p-5">
        <summary className="text-sm text-red-300/90">Delete this client…</summary>
        <p className="mt-3 text-sm text-muted">Their invoices are kept, with the details printed on them; they just stop being linked here.</p>
        <form action={deleteClient} className="mt-4">
          <input type="hidden" name="id" value={client.id} />
          <PendingButton pendingLabel="Deleting…" className="h-10 rounded-md border border-red-400/50 px-4 text-sm text-red-300 hover:bg-red-400/10">
            Delete client
          </PendingButton>
        </form>
      </details>
    </div>
  );
}
