import type { Metadata } from "next";
import Link from "next/link";

import { FIELD } from "@/domains/admin/components/FormField";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { ServiceForm } from "@/domains/catalogue/components/ServiceForm";
import { ServiceRepository } from "@/domains/catalogue/server/ServiceRepository";
import { CatalogueContract } from "@/domains/catalogue/services/CatalogueContract";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";

export const metadata: Metadata = { title: "Services" };

const TAB = "rounded-md px-3 py-1.5 text-sm transition-colors";

/** The service catalogue: search by code or name, active or archived. */
export default async function AdminServicesPage({ searchParams }: PageProps<"/admin/services">) {
  await AdminAuth.requireOwner();
  const repo = ServiceRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const query = await searchParams;
  const archived = query.view === "archived";
  const q = typeof query.q === "string" ? query.q : "";
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const services = (await repo.all({ archived })).filter((s) => CatalogueContract.matches(s, q));
  const tab = (view: string, label: string) => (
    <Link href={`/admin/services${view ? `?view=${view}` : ""}`} className={`${TAB} ${archived === (view === "archived") ? "bg-surface-raised text-ink" : "text-muted hover:text-ink"}`}>
      {label}
    </Link>
  );

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-normal tracking-tight italic">Services</h1>
      <p className="mt-2 text-sm text-muted">What you sell, with a code, and the prices for each way it is billed. Documents copy them when a line is added.</p>

      {!archived && (
        <details className="mt-8 rounded-lg border border-line p-5" open={services.length === 0 && !q}>
          <summary className="cursor-pointer text-sm text-quant">+ New service</summary>
          <div className="mt-5">
            <ServiceForm />
          </div>
        </details>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <nav className="flex gap-1" aria-label="Service status">
          {tab("", "Active")}
          {tab("archived", "Archived")}
        </nav>
        <form className="flex gap-2" role="search">
          {archived && <input type="hidden" name="view" value="archived" />}
          <input name="q" type="search" defaultValue={q} placeholder="Code or name" aria-label="Search services" className={`${FIELD} mt-0 w-56`} />
          <button type="submit" className="rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
            Search
          </button>
        </form>
      </div>

      {services.length === 0 ? (
        <p className="mt-10 text-muted">{q ? `No ${archived ? "archived " : ""}service matches “${q}”.` : archived ? "No archived services." : "No services yet."}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-[0.18em] text-muted uppercase">
                <th className="py-2 pr-4 font-normal">Code</th>
                <th className="py-2 pr-4 font-normal">Service</th>
                <th className="py-2 pr-4 font-normal">Category</th>
                <th className="py-2 pr-4 font-normal">Billed as</th>
                <th className="py-2 font-normal">Prices today</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => {
                const prices = CatalogueContract.current(service, today);
                return (
                  <tr key={service.id} className="border-b border-line/60 align-top hover:bg-surface/60">
                    <td className="py-2.5 pr-4 font-mono">
                      <Link href={`/admin/services/${service.id}`} className="text-quant hover:underline">
                        {service.code}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">{service.name}</td>
                    <td className="py-2.5 pr-4 text-muted">{service.category || "—"}</td>
                    <td className="py-2.5 pr-4 text-muted">{service.units.map((u) => InvoiceContract.UNITS[u]).join(", ")}</td>
                    <td className="py-2.5 font-mono text-xs text-muted">
                      {prices.length === 0
                        ? "No price"
                        : prices.map((p) => (
                            <span key={p.id} className="block whitespace-nowrap">
                              {InvoiceMath.money(p.rateMinor, p.currency)} · {InvoiceContract.UNITS[p.unit]}
                            </span>
                          ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
