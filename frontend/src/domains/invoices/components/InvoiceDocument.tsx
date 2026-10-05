import { siteConfig } from "@/core/config/site";
import { Logo } from "@/core/components/layout/Logo";

import { InvoiceContract } from "../services/InvoiceContract";
import { InvoiceEmails } from "../services/InvoiceEmails";
import { InvoiceMath } from "../services/InvoiceMath";
import type { Invoice } from "../types";

const STAMP: Partial<Record<Invoice["status"], string>> = {
  paid: "border-emerald-400 text-emerald-300",
  void: "border-red-400 text-red-300",
  draft: "border-slate-400 text-slate-300",
};

/** The tagline from the logo artwork. */
const TAGLINE = "Learn Finance the way it is practiced.";

const LABEL = "text-[11px] font-semibold tracking-[0.2em] text-canvas uppercase";
const ROW_LABEL = "text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase";

/**
 * The invoice as the client sees and prints it, also used for the admin
 * preview. Site palette (navy canvas, gold) on white paper; the navy bands
 * force background printing so the light logo stays visible on paper.
 */
export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const money = (minor: number) => InvoiceMath.money(minor, invoice.currency);
  const stamp = STAMP[invoice.status];
  const { whatsapp } = siteConfig.contact;
  const bankRows = invoice.bank ? InvoiceEmails.bankRows(invoice.bank) : [];
  const hasPeriod = invoice.items.some((item) => item.period);
  const firstName = invoice.clientName.trim().split(/\s+/)[0];

  return (
    <article className="mx-auto w-full max-w-3xl overflow-hidden bg-white font-sans text-slate-800 shadow-xl [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:max-w-none print:shadow-none">
      <header className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-gold bg-canvas bg-grid-lines px-8 py-7 sm:px-12">
        <Logo height={44} />
        <div className="text-right">
          <h1 className="font-serif text-3xl font-bold tracking-[0.12em] text-white uppercase">{invoice.taxRateBp > 0 ? "Tax invoice" : "Invoice"}</h1>
          <div className="mt-1 flex items-center justify-end gap-3">
            {stamp && <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase ${stamp}`}>{invoice.status}</span>}
            {invoice.number && <span className="font-mono text-lg text-gold">{invoice.number}</span>}
          </div>
        </div>
      </header>

      <div className="px-8 py-8 sm:px-12">
        <section className="grid gap-8 sm:grid-cols-2 print:grid-cols-2">
          <div className="text-sm leading-relaxed">
            <p className="font-serif text-lg font-bold text-canvas">{siteConfig.name}</p>
            <p className="text-slate-600">
              {whatsapp.owner}
              <br />
              Dubai, United Arab Emirates
              <br />
              {whatsapp.display}
              {siteConfig.contact.email && (
                <>
                  <br />
                  {siteConfig.contact.email}
                </>
              )}
              <br />
              {siteConfig.domain}
              {invoice.trn && (
                <>
                  <br />
                  TRN: {invoice.trn}
                </>
              )}
            </p>
          </div>
          <div className="text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 border-b border-slate-200 pb-3">
              <dt className={LABEL}>Invoice #</dt>
              <dd className="font-mono">{invoice.number ?? "Assigned on issue"}</dd>
              <dt className={LABEL}>Date</dt>
              <dd>{invoice.issueDate ? InvoiceEmails.day(invoice.issueDate) : "On issue"}</dd>
              <dt className={LABEL}>Due</dt>
              <dd>{InvoiceEmails.day(invoice.dueDate)}</dd>
            </dl>
            <h2 className={`${LABEL} mt-4`}>Bill to</h2>
            <p className="mt-1 font-semibold text-slate-900">{invoice.clientName}</p>
            <p className="leading-relaxed text-slate-600">
              {invoice.clientAddress && (
                <>
                  <span className="whitespace-pre-line">{invoice.clientAddress}</span>
                  <br />
                </>
              )}
              <span className="break-all">{invoice.clientEmail}</span>
              {invoice.clientPhone && (
                <>
                  <br />
                  {invoice.clientPhone}
                </>
              )}
            </p>
          </div>
        </section>

        <div className="mt-8 overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[540px] border-b-2 border-canvas text-sm">
            <thead>
              <tr className="bg-canvas text-left text-[11px] tracking-[0.18em] text-white uppercase">
                <th className="w-14 px-3 py-3 font-semibold">No.</th>
                <th className="px-3 py-3 font-semibold">Description</th>
                {hasPeriod && <th className="px-3 py-3 font-semibold">Period</th>}
                <th className="px-3 py-3 text-center font-semibold">Qty</th>
                <th className="px-3 py-3 text-right font-semibold">Unit price</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index} className="border-b border-slate-200 align-top last:border-0">
                  <td className="px-3 py-3 font-mono text-slate-500">{String(index + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-900">{item.description}</p>
                    {item.detail && <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>}
                  </td>
                  {hasPeriod && <td className="px-3 py-3 whitespace-nowrap text-slate-700">{item.period ?? "—"}</td>}
                  <td className="px-3 py-3 text-center tabular-nums">
                    {item.quantity}
                    {item.unit && <span className="block text-[11px] text-slate-500">{InvoiceContract.UNITS[item.unit]}</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(item.unitMinor)}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{money(item.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-8 grid gap-8 sm:grid-cols-[1fr_20rem] print:grid-cols-[1fr_20rem]">
          <div className="break-inside-avoid">
            {(bankRows.length > 0 || invoice.paymentInstructions) && (
              <>
                <h2 className={`${LABEL} border-b border-slate-200 pb-2`}>Payment information</h2>
                {bankRows.length > 0 && (
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                    {bankRows.map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className={ROW_LABEL}>{label}</dt>
                        <dd className="break-words">{value}</dd>
                      </div>
                    ))}
                    <dt className={ROW_LABEL}>Reference</dt>
                    <dd className="font-mono">{invoice.number ?? "Invoice number"}</dd>
                  </dl>
                )}
                {invoice.paymentInstructions && <p className="mt-3 text-sm whitespace-pre-line text-slate-600">{invoice.paymentInstructions}</p>}
              </>
            )}
          </div>
          <dl className="grid h-fit break-inside-avoid grid-cols-[1fr_auto] gap-x-6 gap-y-2 rounded-lg border border-slate-200 p-5 text-sm tabular-nums">
            <dt className="text-slate-500 uppercase">Subtotal</dt>
            <dd className="text-right font-semibold">{money(invoice.subtotalMinor)}</dd>
            {invoice.discountMinor > 0 && (
              <>
                <dt className="text-slate-500 uppercase">Discount</dt>
                <dd className="text-right font-semibold">−{money(invoice.discountMinor)}</dd>
              </>
            )}
            {invoice.taxRateBp > 0 && (
              <>
                <dt className="text-slate-500 uppercase">VAT ({InvoiceMath.percent(invoice.taxRateBp)}%)</dt>
                <dd className="text-right font-semibold">{money(invoice.taxMinor)}</dd>
              </>
            )}
            <div className="col-span-2 mt-2 flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
              <dt className={`${LABEL} whitespace-nowrap`}>Total due</dt>
              <dd className="font-serif text-xl font-bold whitespace-nowrap text-canvas">{money(invoice.totalMinor)}</dd>
            </div>
          </dl>
        </section>

        {invoice.notes && (
          <section className="mt-8 break-inside-avoid">
            <h2 className={`${LABEL} border-b border-slate-200 pb-2`}>Terms &amp; notes</h2>
            <p className="mt-3 text-sm whitespace-pre-line text-slate-600">{invoice.notes}</p>
          </section>
        )}

        <section className="mt-8 grid break-inside-avoid gap-6 rounded-lg border border-slate-200 border-l-4 border-l-gold bg-slate-50 p-6 sm:grid-cols-[1fr_auto] sm:items-center print:grid-cols-[1fr_auto]">
          <div>
            <h2 className="font-serif text-2xl font-bold text-canvas">Thank you{firstName ? `, ${firstName}` : ""}.</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Thank you for learning with {siteConfig.name}. Every session is built around your own attempts, so keep bringing the
              questions you find hardest. Questions about this invoice, or ready to book your next session? We are one message away.
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className={ROW_LABEL}>WhatsApp</dt>
            <dd className="font-semibold text-slate-900">{whatsapp.display}</dd>
            {siteConfig.contact.email && (
              <>
                <dt className={ROW_LABEL}>Email</dt>
                <dd className="font-semibold text-slate-900">{siteConfig.contact.email}</dd>
              </>
            )}
            <dt className={ROW_LABEL}>Book</dt>
            <dd className="font-semibold text-slate-900">{siteConfig.domain}</dd>
          </dl>
        </section>
      </div>

      <footer className="bg-canvas bg-grid-lines px-8 py-5 text-center">
        <p className="text-sm font-semibold tracking-[0.12em] text-gold">{TAGLINE}</p>
      </footer>
    </article>
  );
}
