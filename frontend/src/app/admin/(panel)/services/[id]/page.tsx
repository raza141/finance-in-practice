import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { addServicePrice, archiveService, removeServicePrice } from "@/domains/catalogue/actions/services";
import { ServiceForm } from "@/domains/catalogue/components/ServiceForm";
import { ServiceRepository } from "@/domains/catalogue/server/ServiceRepository";
import { CatalogueContract } from "@/domains/catalogue/services/CatalogueContract";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

export const metadata: Metadata = { title: "Service" };

const NOTICES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  created: { text: "Service added. Add its prices below.", tone: "ok" },
  saved: { text: "Service saved. Documents already issued keep what they were issued with.", tone: "ok" },
  archived: { text: "Archived: hidden from new documents, still shown on the ones that used it.", tone: "ok" },
  reactivated: { text: "Reactivated: offered on new documents again.", tone: "ok" },
  "price-added": { text: "Price added. An open price for the same basis and currency now ends the day before.", tone: "ok" },
  "price-removed": { text: "Price removed.", tone: "ok" },
  "price-restored": { text: "Price removed; the price it replaced is back in force.", tone: "ok" },
  "price-refused": { text: "Price not added.", tone: "warn" },
};

const BUTTON = "h-9 rounded-md border border-line px-3 text-sm text-muted transition-colors hover:text-ink";

/** Edit a service, manage its dated prices, archive or reactivate it. */
export default async function ServicePage({ params, searchParams }: PageProps<"/admin/services/[id]">) {
  await AdminAuth.requireOwner();
  const [service, settings] = await Promise.all([ServiceRepository.fromEnv()?.byId((await params).id), SettingsRepository.load()]);
  if (!service) notFound();
  const query = await searchParams;
  const notice = NOTICES[String(query.notice)];
  const reason = typeof query.reason === "string" ? query.reason : null;
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const live = new Set(CatalogueContract.current(service, today).map((p) => p.id));
  const id = <input type="hidden" name="id" value={service.id} />;

  return (
    <div className="max-w-4xl">
      <Link href={`/admin/services${service.archivedAt ? "?view=archived" : ""}`} className="text-sm text-muted hover:text-ink">
        ← Services
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">{service.name}</h1>
        <span className="font-mono text-sm text-muted">{service.code}</span>
        {service.archivedAt && <span className="rounded border border-line px-2 py-0.5 font-mono text-[11px] tracking-wider text-muted uppercase">Archived</span>}
      </div>
      {notice && (
        <p role="status" className={`mt-4 text-sm ${notice.tone === "ok" ? "text-quant" : "text-gold"}`}>
          {notice.text}
          {reason && ` ${reason}`}
        </p>
      )}

      <div className="mt-8">
        <ServiceForm key={`${service.id}-${service.code}-${service.units.join()}`} service={service} />
      </div>

      <section className="mt-10 rounded-lg border border-line p-5">
        <h2 className="text-lg">Prices</h2>
        <p className="mt-1 text-sm text-muted">
          One rate per basis and currency at a time. A new price ends the open one the day before it starts; documents already issued keep their own rates.
        </p>
        {service.prices.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No prices yet: new lines for this service start with an empty price.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/60 text-sm">
            {service.prices.map((price) => (
              <li key={price.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <span className="w-28">{InvoiceContract.UNITS[price.unit]}</span>
                <span className="w-40 font-mono tabular-nums">
                  {InvoiceMath.money(price.rateMinor, price.currency)}
                  <span className="text-xs text-muted"> / {settings.units[price.unit].label}</span>
                </span>
                <span className="flex-1 text-muted">
                  {InvoiceEmails.day(price.effectiveFrom)} – {price.effectiveTo ? InvoiceEmails.day(price.effectiveTo) : "open"}
                  {live.has(price.id) && <span className="ml-2 text-quant">current</span>}
                  {!service.units.includes(price.unit) && <span className="ml-2 text-gold">basis no longer offered</span>}
                </span>
                <form action={removeServicePrice}>
                  {id}
                  <input type="hidden" name="priceId" value={price.id} />
                  <PendingButton pendingLabel="Removing…" className="text-xs text-red-300/90 hover:underline">
                    Remove
                  </PendingButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addServicePrice} className="mt-5 grid items-end gap-3 sm:grid-cols-5">
          {id}
          <label className="text-xs text-muted">
            Basis
            <select name="unit" defaultValue={service.defaultUnit ?? service.units[0]} className={`${FIELD} mt-1`}>
              {service.units.map((unit) => (
                <option key={unit} value={unit}>
                  {InvoiceContract.UNITS[unit]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Currency
            <select name="currency" defaultValue={settings.currency} className={`${FIELD} mt-1`}>
              {InvoiceContract.CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Rate or fee
            <input name="rate" inputMode="decimal" required placeholder="0.00" className={`${FIELD} mt-1`} />
          </label>
          <label className="text-xs text-muted">
            From
            <input name="effectiveFrom" type="date" required defaultValue={today} className={`${FIELD} mt-1`} />
          </label>
          <label className="text-xs text-muted">
            Until (optional)
            <input name="effectiveTo" type="date" className={`${FIELD} mt-1`} />
          </label>
          <PendingButton pendingLabel="Adding…" className={`${BUTTON} sm:col-span-5 sm:justify-self-start`}>
            Add price
          </PendingButton>
        </form>
      </section>

      <form action={archiveService} className="mt-10">
        {id}
        <input type="hidden" name="archive" value={service.archivedAt ? "false" : "true"} />
        <PendingButton pendingLabel="Saving…" className={BUTTON}>
          {service.archivedAt ? "Reactivate service" : "Archive service"}
        </PendingButton>
        <p className="mt-2 text-xs text-muted">
          {service.archivedAt
            ? "Reactivating offers it on new documents again."
            : "Archiving hides it from new documents. Documents that already used it are unchanged."}
        </p>
      </form>
    </div>
  );
}
