import { Logo } from "@/core/components/layout/Logo";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";
import type { BillingSettings } from "@/domains/settings/types";
import { WHATSAPP_GLYPH } from "@/core/components/ui/WhatsAppButton";

import { InvoiceEmails } from "../services/InvoiceEmails";
import { InvoiceMath } from "../services/InvoiceMath";
import type { Invoice, ItemUnit } from "../types";

const STAMP: Partial<Record<Invoice["status"], string>> = {
  paid: "border-emerald-400 text-emerald-300",
  void: "border-red-400 text-red-300",
  draft: "border-slate-400 text-slate-300",
};

/** The tagline from the logo artwork. */
const TAGLINE = "Learn Finance the way it is practiced.";

/** Gold, letter-spaced section label: From, Bill to, Details, Payment desk, Terms. */
const LABEL = "font-mono text-[11px] font-semibold tracking-[0.25em] text-gold uppercase";
/** Row label inside a section. */
const ROW_LABEL = "font-mono text-[11px] tracking-[0.18em] whitespace-nowrap text-slate-500 uppercase";
const TH = "px-3 py-3 font-mono text-[11px] font-semibold tracking-[0.2em] text-slate-900 uppercase";
/** The unit beside a line's quantity: "1 month", "1.5 hours". */
const QTY_UNIT: Record<ItemUnit, (quantity: number) => string> = {
  hour: (q) => (q === 1 ? "hour" : "hours"),
  month: (q) => (q === 1 ? "month" : "months"),
  "on-demand": () => "on demand",
  contract: () => "contract",
};
/** Bank rows whose values are codes, set in mono. */
const CODE_ROWS = new Set(["Account number", "IBAN", "SWIFT / BIC"]);

/**
 * The invoice as the client sees and prints it, also used for the admin
 * preview. Site palette (navy canvas, gold) on white paper; the navy bands
 * force background printing so the light logo stays visible on paper.
 */
export function InvoiceDocument({ invoice, settings }: { invoice: Invoice; settings: BillingSettings }) {
  const money = (minor: number) => InvoiceMath.money(minor, invoice.currency);
  const stamp = STAMP[invoice.status];
  const { business } = settings;
  const terms = SettingsContract.terms(settings.documents.invoice.terms);
  const bankRows = invoice.bank ? InvoiceEmails.bankRows(invoice.bank) : [];
  const hasPeriod = invoice.items.some((item) => item.period);
  const firstName = InvoiceEmails.firstName(invoice.clientName);

  return (
    <article data-invoice className="mx-auto w-full max-w-3xl overflow-hidden bg-white font-sans text-slate-800 shadow-xl [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:max-w-none print:shadow-none">
      <header className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-gold bg-canvas bg-grid-lines px-8 py-7 sm:px-12">
        <Logo height={44} />
        <div className="text-right">
          <h1 className="font-serif text-3xl font-bold tracking-[0.12em] text-white uppercase">
            {invoice.taxRateBp > 0 ? "Tax invoice" : "Invoice"}
          </h1>
          <div className="mt-1 flex items-center justify-end gap-3">
            {stamp && (
              <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase ${stamp}`}>
                {invoice.status}
              </span>
            )}
            {invoice.number && <span className="font-mono text-lg text-gold">{invoice.number}</span>}
          </div>
        </div>
      </header>

      <div className="px-8 py-10 sm:px-12">
        <section className="grid gap-8 text-sm leading-relaxed sm:grid-cols-[1fr_1fr_auto] print:grid-cols-[1fr_1fr_auto]">
          <div>
            <h2 className={LABEL}>From</h2>
            <p className="mt-3 font-serif text-lg font-bold text-canvas">{business.name}</p>
            <p className="mt-1 text-slate-500">
              {[business.sender, business.address, business.phone, business.email, business.website, invoice.trn && `TRN: ${invoice.trn}`]
                .filter(Boolean)
                .map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
            </p>
          </div>
          <div>
            <h2 className={LABEL}>Bill to</h2>
            <p className="mt-3 font-serif text-lg font-bold text-canvas">{invoice.clientName}</p>
            <p className="mt-1 text-slate-500">
              {invoice.clientAddress && <span className="block whitespace-pre-line">{invoice.clientAddress}</span>}
              {invoice.clientEmail && <span className="block break-all">{invoice.clientEmail}</span>}
              {invoice.clientPhone && <span className="block">{invoice.clientPhone}</span>}
            </p>
          </div>
          <div>
            <h2 className={LABEL}>Details</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-1.5">
              <dt className={ROW_LABEL}>Invoice no.</dt>
              <dd className="font-semibold whitespace-nowrap text-slate-900">{invoice.number ?? "Assigned on issue"}</dd>
              <dt className={ROW_LABEL}>Issued</dt>
              <dd className="font-semibold text-slate-900">{invoice.issueDate ? InvoiceEmails.day(invoice.issueDate) : "On issue"}</dd>
              <dt className={ROW_LABEL}>Due</dt>
              <dd className="font-semibold text-slate-900">{InvoiceEmails.day(invoice.dueDate)}</dd>
              <dt className={ROW_LABEL}>Currency</dt>
              <dd className="font-semibold text-slate-900">{invoice.currency}</dd>
            </dl>
          </div>
        </section>

        <div className="mt-10 overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[540px] border-t-2 border-canvas text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className={`${TH} w-14`}>No.</th>
                <th className={TH}>Description</th>
                {hasPeriod && <th className={TH}>Period</th>}
                <th className={`${TH} text-right`}>Qty</th>
                <th className={`${TH} text-right`}>Unit price</th>
                <th className={`${TH} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index} className="border-b border-slate-200 align-top">
                  <td className="px-3 py-4 font-mono text-slate-500">{String(index + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-4">
                    <p className="font-semibold text-slate-900">{item.description}</p>
                    {item.detail && <p className="mt-0.5 text-slate-500">{item.detail}</p>}
                  </td>
                  {hasPeriod && (
                    <td className="px-3 py-4 whitespace-nowrap text-slate-900">{item.period ? InvoiceEmails.period(item.period) : "—"}</td>
                  )}
                  <td className="px-3 py-4 text-right whitespace-nowrap tabular-nums">
                    {item.quantity}
                    {item.unit && <span className="ml-1 text-xs text-slate-500">{QTY_UNIT[item.unit](item.quantity)}</span>}
                  </td>
                  <td className="px-3 py-4 text-right whitespace-nowrap tabular-nums">{money(item.unitMinor)}</td>
                  <td className="px-3 py-4 text-right font-bold whitespace-nowrap text-slate-900 tabular-nums">{money(item.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-10 grid gap-8 sm:grid-cols-[1fr_19rem] sm:gap-16 print:grid-cols-[1fr_19rem] print:gap-16">
          <div className="break-inside-avoid">
            {(bankRows.length > 0 || invoice.paymentInstructions) && (
              <>
                <h2 className={LABEL}>Payment desk</h2>
                {bankRows.length > 0 && (
                  <dl className="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-0.5 text-sm">
                    {bankRows.map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className={ROW_LABEL}>{label === "Bank name" ? "Bank" : label === "Account number" ? "Account no." : label}</dt>
                        <dd className={`break-words text-slate-900 ${CODE_ROWS.has(label) ? "font-mono" : "font-semibold"}`}>{value}</dd>
                      </div>
                    ))}
                    <dt className={ROW_LABEL}>Reference</dt>
                    <dd className="font-mono text-slate-900">{invoice.number ?? "Invoice number"}</dd>
                  </dl>
                )}
                {invoice.paymentInstructions && <p className="mt-3 text-sm whitespace-pre-line text-slate-500">{invoice.paymentInstructions}</p>}
              </>
            )}
          </div>
          <dl className="grid h-fit break-inside-avoid grid-cols-[1fr_auto] gap-x-6 gap-y-3 rounded-md border border-slate-200 border-l-4 border-l-gold bg-slate-50 p-6 text-sm tabular-nums">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="text-right text-slate-500">{money(invoice.subtotalMinor)}</dd>
            {invoice.discountMinor > 0 && (
              <>
                <dt className="text-slate-500">Discount</dt>
                <dd className="text-right text-slate-500">−{money(invoice.discountMinor)}</dd>
              </>
            )}
            {invoice.taxRateBp > 0 && (
              <>
                <dt className="text-slate-500">VAT ({InvoiceMath.percent(invoice.taxRateBp)}%)</dt>
                <dd className="text-right text-slate-500">{money(invoice.taxMinor)}</dd>
              </>
            )}
            {invoice.paidMinor > 0 && (
              <>
                <dt className="text-slate-500">Total</dt>
                <dd className="text-right text-slate-500">{money(invoice.totalMinor)}</dd>
                <dt className="text-emerald-700">Paid to date</dt>
                <dd className="text-right text-emerald-700">−{money(invoice.paidMinor)}</dd>
              </>
            )}
            <div className="col-span-2 mt-1 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
              <dt className="font-mono text-[11px] font-semibold tracking-[0.2em] whitespace-nowrap text-slate-900 uppercase">
                {invoice.paidMinor > 0 ? "Balance due" : "Total due"}
              </dt>
              <dd className="font-serif text-2xl font-bold whitespace-nowrap text-canvas">{money(invoice.totalMinor - invoice.paidMinor)}</dd>
            </div>
          </dl>
        </section>

        {invoice.notes && (
          <section className="mt-8 break-inside-avoid">
            <h2 className={LABEL}>Notes</h2>
            <p className="mt-3 text-sm whitespace-pre-line text-slate-500">{invoice.notes}</p>
          </section>
        )}

        <section className="mt-10 grid break-inside-avoid gap-8 border-t border-slate-200 pt-8 sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]">
          <div className="border-l-4 border-gold pl-5">
            <h2 className="font-serif text-xl font-bold text-canvas">Thank you{firstName ? `, ${firstName}` : ""}.</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
              Thank you for choosing {business.name}. Questions about this invoice and bookings for the next session are handled by WhatsApp or email.
            </p>
          </div>
          <dl className="grid h-fit grid-cols-[1.25rem_auto_1fr] items-center gap-x-4 gap-y-3 text-sm">
            <Icon path={WHATSAPP_GLYPH} fill />
            <dt className={ROW_LABEL}>WhatsApp</dt>
            <dd className="font-semibold text-slate-900">{business.phone}</dd>
            <Icon path="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
            <dt className={ROW_LABEL}>Book</dt>
            <dd className="font-semibold text-slate-900">{business.website}</dd>
          </dl>
        </section>

        {terms.length > 0 && (
          <section className="mt-10 break-inside-avoid">
            <h2 className={LABEL}>Terms</h2>
            <ol className="mt-3 grid list-decimal gap-1.5 pl-5 text-xs leading-relaxed text-slate-500 marker:text-slate-500">
              {terms.map(([title, text], index) => (
                <li key={index}>
                  {title && <span className="font-semibold text-slate-900">{title}:</span>} {text}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t-4 border-gold bg-canvas bg-grid-lines px-8 py-6 sm:px-12">
        <p className="font-mono text-xs font-semibold tracking-[0.25em] text-gold uppercase">{TAGLINE}</p>
        <p className="text-xs text-slate-300">
          {[business.website, business.phone].filter(Boolean).join(" · ")}
        </p>
      </footer>
    </article>
  );
}

/** An 18px icon in the contact rows: WhatsApp is a filled glyph, the rest are outline icons. */
function Icon({ path, fill = false }: { path: string; fill?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      className="text-slate-900"
      {...(fill
        ? { fill: "currentColor" }
        : {
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.8,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          })}
    >
      <path d={path} />
    </svg>
  );
}
