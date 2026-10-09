import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { ServiceRepository } from "@/domains/catalogue/server/ServiceRepository";
import { CatalogueContract } from "@/domains/catalogue/services/CatalogueContract";
import { addAgreement, deleteClient, endAgreement } from "@/domains/invoices/actions/billing";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { badgeFor, StatusBadge } from "@/domains/invoices/components/AdminBits";
import { ClientForm } from "@/domains/invoices/components/BillingForms";
import { AgreementRepository } from "@/domains/invoices/server/AgreementRepository";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { Ledger } from "@/domains/invoices/services/Ledger";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";

export const metadata: Metadata = { title: "Client" };

const NOTICES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  "agreement-added": { text: "Agreement added. It is offered on this client's new documents for that service.", tone: "ok" },
  "agreement-ended": { text: "Agreement ended. Documents that used it keep their rates.", tone: "ok" },
  "agreement-refused": { text: "Agreement not added.", tone: "warn" },
};

const LEDGER_KIND = { invoice: "Invoice", receipt: "Receipt", credit_note: "Credit note", payment: "Payment for" } as const;

/** Edit a saved client; see their account (running balance), statements and every document. */
export default async function ClientPage({ params, searchParams }: PageProps<"/admin/clients/[id]">) {
  await AdminAuth.requireOwner();
  const { id } = await params;
  const client = await ClientRepository.fromEnv()?.byId(id);
  if (!client) notFound();
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const invoiceRepo = InvoiceRepository.fromEnv();
  const [invoices, courses, entries, agreements, services] = await Promise.all([
    invoiceRepo?.list({ clientId: client.id }) ?? [],
    CourseRepository.fromEnv()?.all() ?? [],
    invoiceRepo?.ledger(client.id) ?? [],
    AgreementRepository.fromEnv()?.forClient(client.id) ?? [],
    ServiceRepository.fromEnv()?.all() ?? [],
  ]);
  const query = await searchParams;
  const notice = NOTICES[String(query.notice)];
  const reason = typeof query.reason === "string" ? query.reason : null;
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

      {notice && (
        <p role="status" className={`mt-4 text-sm ${notice.tone === "ok" ? "text-quant" : "text-gold"}`}>
          {notice.text}
          {reason && ` ${reason}`}
        </p>
      )}

      <div className="mt-8">
        <ClientForm key={client.id} client={client} courses={courses.map((c) => c.title)} />
      </div>

      <section id="agreements" className="mt-12 rounded-lg border border-line p-5">
        <h2 className="text-lg">Agreements</h2>
        <p className="mt-1 text-sm text-muted">
          An agreed rate for one service, basis and currency over dates. On a new document it is offered for that service, never applied without you picking it.
        </p>
        {agreements.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No agreements: new lines use catalogue prices.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/60 text-sm">
            {agreements.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <span className="font-mono text-quant">{a.serviceCode}</span>
                <span className="flex-1">
                  {a.serviceName} · {InvoiceMath.money(a.rateMinor, a.currency)} {InvoiceContract.UNITS[a.unit].toLowerCase()}
                  <span className="text-muted">
                    {" "}
                    · {InvoiceEmails.day(a.startsOn)} – {a.endsOn ? InvoiceEmails.day(a.endsOn) : "open"}
                    {a.paymentTerms && ` · ${InvoiceContract.termsLabel(a.paymentTerms, a.termsDays)}`}
                    {a.schedule && ` · ${a.schedule}`}
                  </span>
                  {a.scope && <span className="block text-xs text-muted">{a.scope}</span>}
                </span>
                <form action={endAgreement}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="agreementId" value={a.id} />
                  <PendingButton pendingLabel="Ending…" className="text-xs text-red-300/90 hover:underline">
                    End
                  </PendingButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        {services.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Add services first under{" "}
            <Link href="/admin/services" className="text-quant hover:underline">
              Services
            </Link>
            .
          </p>
        ) : (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-quant">+ New agreement</summary>
            <form action={addAgreement} className="mt-4 grid items-end gap-3 sm:grid-cols-4">
              <input type="hidden" name="clientId" value={client.id} />
              <label className="text-xs text-muted sm:col-span-2">
                Service
                <select name="serviceId" required className={`${FIELD} mt-1`}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {CatalogueContract.label(s)} ({s.units.map((u) => InvoiceContract.UNITS[u].toLowerCase()).join(", ")})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Billed
                <select name="unit" className={`${FIELD} mt-1`}>
                  {CatalogueContract.UNIT_ORDER.map((u) => (
                    <option key={u} value={u}>
                      {InvoiceContract.UNITS[u]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Currency
                <select name="currency" defaultValue={client.planCurrency} className={`${FIELD} mt-1`}>
                  {InvoiceContract.CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Agreed rate or fee
                <input name="rate" inputMode="decimal" required placeholder="0.00" className={`${FIELD} mt-1`} />
              </label>
              <label className="text-xs text-muted">
                From
                <input name="startsOn" type="date" required defaultValue={today} className={`${FIELD} mt-1`} />
              </label>
              <label className="text-xs text-muted">
                Until (optional)
                <input name="endsOn" type="date" className={`${FIELD} mt-1`} />
              </label>
              <label className="text-xs text-muted">
                Terms (optional)
                <span className="mt-1 flex gap-2">
                  <select name="paymentTerms" className={`${FIELD} mt-0`}>
                    <option value="">Client / default</option>
                    {InvoiceContract.OFFERED_TERMS.filter((t) => t !== "date").map((t) => (
                      <option key={t} value={t}>
                        {InvoiceContract.PAYMENT_TERMS[t]}
                      </option>
                    ))}
                  </select>
                  <input name="termsDays" aria-label="Days, for custom terms" inputMode="numeric" placeholder="days" className={`${FIELD} mt-0 w-16`} />
                </span>
              </label>
              <label className="text-xs text-muted sm:col-span-2">
                Billing schedule (optional)
                <input name="schedule" maxLength={200} placeholder="e.g. Billed on the 1st of each month" className={`${FIELD} mt-1`} />
              </label>
              <label className="text-xs text-muted sm:col-span-2">
                Scope / included (optional)
                <input name="scope" maxLength={500} placeholder="e.g. 8 sessions a month, mock exams included" className={`${FIELD} mt-1`} />
              </label>
              <PendingButton pendingLabel="Adding…" className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-ink sm:col-span-4 sm:justify-self-start">
                Add agreement
              </PendingButton>
            </form>
          </details>
        )}
      </section>

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
