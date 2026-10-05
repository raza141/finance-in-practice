import { siteConfig } from "@/core/config/site";

import { InvoiceEmails } from "../services/InvoiceEmails";
import { InvoiceMath } from "../services/InvoiceMath";
import type { Invoice } from "../types";

const STAMP: Partial<Record<Invoice["status"], string>> = {
  paid: "border-emerald-600 text-emerald-700",
  void: "border-red-600 text-red-700",
  draft: "border-slate-400 text-slate-500",
};

/**
 * The invoice as the client sees and prints it. Explicit light colours, not
 * the dark site tokens, so it prints as dark text on white paper.
 */
export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const money = (minor: number) => InvoiceMath.money(minor, invoice.currency);
  const stamp = STAMP[invoice.status];

  return (
    <article className="relative mx-auto w-full max-w-3xl bg-white p-8 font-sans text-slate-900 shadow-xl sm:p-12 print:max-w-none print:p-0 print:shadow-none">
      {stamp && (
        <p className={`absolute top-10 right-10 rotate-6 rounded border-2 px-3 py-1 font-mono text-lg font-bold tracking-widest uppercase ${stamp}`}>
          {invoice.status}
        </p>
      )}
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <p className="font-serif text-2xl italic">{siteConfig.name}</p>
          <p className="mt-1 text-sm text-slate-600">
            {siteConfig.contact.whatsapp.owner}
            <br />
            Dubai, United Arab Emirates
            <br />
            {siteConfig.domain} · {siteConfig.contact.whatsapp.display}
            {invoice.trn && (
              <>
                <br />
                TRN: {invoice.trn}
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          <h1 className="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">{invoice.taxRateBp > 0 ? "Tax invoice" : "Invoice"}</h1>
          <p className="mt-1 font-mono text-xl">{invoice.number ?? "DRAFT"}</p>
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Bill to</h2>
          <p className="mt-1">{invoice.clientName}</p>
          <p className="text-sm text-slate-600">{invoice.clientEmail}</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] justify-start gap-x-6 gap-y-1 text-sm sm:justify-end print:justify-end">
          <dt className="text-slate-500">Issue date</dt>
          <dd>{invoice.issueDate ? InvoiceEmails.day(invoice.issueDate) : "Not issued"}</dd>
          <dt className="text-slate-500">Due date</dt>
          <dd>{InvoiceEmails.day(invoice.dueDate)}</dd>
          <dt className="text-slate-500">Currency</dt>
          <dd>{invoice.currency}</dd>
        </dl>
      </section>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-xs tracking-widest text-slate-500 uppercase">
            <th className="py-2 font-semibold">Description</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">Unit price</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={index} className="border-b border-slate-100 align-top">
              <td className="py-2 pr-4">{item.description}</td>
              <td className="py-2 text-right tabular-nums">{item.quantity}</td>
              <td className="py-2 text-right tabular-nums">{money(item.unitMinor)}</td>
              <td className="py-2 text-right tabular-nums">{money(item.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4 ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
        <dt className="text-slate-500">Subtotal</dt>
        <dd className="text-right">{money(invoice.subtotalMinor)}</dd>
        {invoice.discountMinor > 0 && (
          <>
            <dt className="text-slate-500">Discount</dt>
            <dd className="text-right">−{money(invoice.discountMinor)}</dd>
          </>
        )}
        {invoice.taxRateBp > 0 && (
          <>
            <dt className="text-slate-500">VAT {InvoiceMath.percent(invoice.taxRateBp)}%</dt>
            <dd className="text-right">{money(invoice.taxMinor)}</dd>
          </>
        )}
        <dt className="border-t border-slate-300 pt-2 font-semibold">Total due</dt>
        <dd className="border-t border-slate-300 pt-2 text-right font-semibold">{money(invoice.totalMinor)}</dd>
      </dl>

      {invoice.paymentInstructions && (
        <section className="mt-10 break-inside-avoid">
          <h2 className="text-xs font-semibold tracking-widest text-slate-500 uppercase">How to pay</h2>
          <p className="mt-2 text-sm whitespace-pre-line">{invoice.paymentInstructions}</p>
        </section>
      )}
      {invoice.notes && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Notes</h2>
          <p className="mt-2 text-sm whitespace-pre-line">{invoice.notes}</p>
        </section>
      )}
      <p className="mt-12 text-center text-xs text-slate-500">Thank you for learning with {siteConfig.name}.</p>
    </article>
  );
}
