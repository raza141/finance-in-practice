import type { Metadata } from "next";
import Link from "next/link";

import { FIELD } from "@/domains/admin/components/FormField";
import { PageHeader, PRIMARY_ACTION } from "@/domains/admin/components/PageHeader";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { AdminInbox } from "@/domains/admin/server/AdminInbox";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { ClientForm } from "@/domains/invoices/components/BillingForms";
import { AgreementRepository } from "@/domains/invoices/server/AgreementRepository";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import type { Agreement } from "@/domains/invoices/types";

export const metadata: Metadata = { title: "Clients" };

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** "AED 3,000.00 a month · 30 h · to 14 Nov", or the plan on the client record. */
function deal(agreement: Agreement | undefined, plan: string): { text: string; agreed: boolean } {
  if (!agreement) return { text: plan || "No plan", agreed: false };
  const parts = [
    `${InvoiceMath.money(agreement.rateMinor, agreement.currency)} ${InvoiceContract.UNITS[agreement.unit].toLowerCase()}`,
    agreement.hoursPerMonth !== null && `${agreement.hoursPerMonth} h a month`,
    agreement.endsOn && `to ${DAY.format(new Date(`${agreement.endsOn}T00:00:00Z`))}`,
  ];
  return { text: parts.filter(Boolean).join(" · "), agreed: true };
}

/** Every client, searchable; each row opens their page (agreements, hours, account). */
export default async function AdminClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await AdminAuth.requireOwner();
  const repo = ClientRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
  const [clients, courses, unseen, agreements] = await Promise.all([
    repo.all(),
    CourseRepository.fromEnv()?.all() ?? [],
    AdminInbox.unseenIds(),
    AgreementRepository.fromEnv()?.active() ?? [],
  ]);
  const agreementOf = new Map<string, Agreement>();
  for (const a of agreements) if (!agreementOf.has(a.clientId)) agreementOf.set(a.clientId, a);
  const shown = (search ? clients.filter((c) => [c.name, c.email, c.phone, ...c.courses].some((v) => v.toLowerCase().includes(search))) : clients).toSorted(
    // Waiting on you first: a switch to answer, then new.
    (a, b) => Number(!!b.requestedBasis) - Number(!!a.requestedBasis) || Number(unseen.has(b.id)) - Number(unseen.has(a.id)),
  );
  const adding = query.new === "1" || clients.length === 0;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Clients"
        description={`${clients.length} clients. Open one for their agreements, hours, account, study plan and Classroom.`}
        actions={
          <Link href={adding ? "/admin/clients" : "/admin/clients?new=1"} className={PRIMARY_ACTION}>
            {adding ? "Close" : "Add client"}
          </Link>
        }
      />

      {adding && (
        <section aria-label="New client" className="mt-6 rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">New client</h2>
          <div className="mt-4">
            <ClientForm courses={courses.map((c) => c.title)} />
          </div>
        </section>
      )}

      <form className="mt-6 flex max-w-md gap-2" role="search">
        <label className="sr-only" htmlFor="client-search">
          Search clients
        </label>
        <input id="client-search" name="q" type="search" defaultValue={search} placeholder="Name, email, phone or course…" autoComplete="off" className={`${FIELD} mt-0`} />
        <button type="submit" className="h-10 rounded-md border border-line px-4 text-sm text-muted hover:text-ink">
          Search
        </button>
      </form>

      {clients.length === 0 ? (
        <p className="mt-10 text-muted">No clients yet. Website bookings and student registrations add them automatically.</p>
      ) : shown.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          No client matches &ldquo;{search}&rdquo;.{" "}
          <Link href="/admin/clients" className="text-quant hover:underline">
            Show all
          </Link>
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {shown.map((client) => {
            const d = deal(agreementOf.get(client.id), InvoiceContract.planSummary(client));
            return (
              <li key={client.id} className="grid items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-raised/60 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Link href={`/admin/clients/${client.id}`} className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-quant/10 text-xs font-semibold text-quant">
                    {initials(client.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-ink">{client.name}</span>
                      {unseen.has(client.id) && <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold text-canvas">New</span>}
                      {client.requestedBasis && (
                        <span className="shrink-0 rounded-full border border-gold/60 px-2 py-0.5 text-[10px] font-semibold text-gold">
                          Wants {client.requestedBasis === "month" ? "monthly" : "hourly"}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted">{[client.email, client.phone].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
                <span className="flex min-w-0 flex-wrap gap-1">
                  {client.courses.length === 0 ? (
                    <span className="text-xs text-muted">No course</span>
                  ) : (
                    client.courses.map((c) => (
                      <span key={c} className="truncate rounded-full border border-line px-2 py-0.5 text-xs text-ink/80">
                        {c}
                      </span>
                    ))
                  )}
                </span>
                <span className={`min-w-0 truncate text-xs tabular-nums ${d.agreed ? "text-ink/90" : "text-muted"}`} title={d.text}>
                  {d.agreed && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-quant align-middle" aria-hidden />}
                  {d.text}
                </span>
                <span className="flex gap-3 text-xs sm:justify-end">
                  <Link href={`/admin/clients/${client.id}#sessions`} className="text-muted hover:text-ink">
                    Hours
                  </Link>
                  <Link href={`/admin/invoices/new?client=${client.id}`} className="text-muted hover:text-ink">
                    Invoice
                  </Link>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
