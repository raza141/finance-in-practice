import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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

export const metadata: Metadata = { title: "Client" };

/** Edit a saved client and see every invoice billed to them. */
export default async function ClientPage({ params }: PageProps<"/admin/clients/[id]">) {
  await AdminAuth.require();
  const { id } = await params;
  const client = await ClientRepository.fromEnv()?.byId(id);
  if (!client) notFound();
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const [invoices, courses] = await Promise.all([InvoiceRepository.fromEnv()?.list(client.id) ?? [], CourseRepository.fromEnv()?.all() ?? []]);

  return (
    <div className="max-w-4xl">
      <Link href="/admin/clients" className="text-sm text-muted hover:text-ink">
        ← Clients
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">{client.name}</h1>
        <Link href={`/admin/invoices/new?client=${client.id}`} className="h-10 rounded-md bg-quant/15 px-4 py-2 text-sm font-medium text-quant hover:bg-quant/25">
          New invoice
        </Link>
      </div>

      <div className="mt-8">
        <ClientForm key={client.id} client={client} courses={courses.map((c) => c.title)} />
      </div>

      <h2 className="mt-12 mb-4 text-lg">Invoices</h2>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted">No invoices for this client yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line text-sm">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
              <Link href={`/admin/invoices/${invoice.id}`} className="font-mono text-quant hover:underline">
                {invoice.number ?? "Draft"}
              </Link>
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
