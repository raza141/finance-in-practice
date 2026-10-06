import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";
import type { BillingSettings } from "@/domains/settings/types";

import { DocumentFormat } from "../services/DocumentFormat";
import { InvoiceContract } from "../services/InvoiceContract";
import { InvoiceEmails } from "../services/InvoiceEmails";
import { InvoiceMath } from "../services/InvoiceMath";
import type { Invoice } from "../types";
import { DocumentFrame, FromBlock, LABEL, ROW_LABEL, TermsBlock, TextBlock, ThankYou } from "./DocumentParts";

const TH = "px-3 py-3 print:py-2 font-mono text-[11px] font-semibold tracking-[0.2em] text-slate-900 uppercase";
/** Bank rows whose values are codes, set in mono. */
const CODE_ROWS = new Set(["Account number", "IBAN", "SWIFT / BIC"]);

const THANKS: Record<"invoice" | "quote" | "credit_note", (business: string) => string> = {
  invoice: (business) => `Thank you for choosing ${business}. Questions about this invoice and bookings for the next session are handled by WhatsApp or email.`,
  quote: (business) => `Thank you for considering ${business}. Questions about this quote are handled by WhatsApp or email.`,
  credit_note: () => "This credit note reduces the balance of the invoice shown in the details. Questions are handled by WhatsApp or email.",
};

/**
 * An invoice, quote or credit note as the client sees and prints it, also the
 * admin preview. A consultancy layout adds Scope and Deliverables before the
 * fees, and Expenses and Assumptions after them.
 */
export function InvoiceDocument({ invoice, settings }: { invoice: Invoice; settings: BillingSettings }) {
  const docType = invoice.docType === "receipt" ? "invoice" : invoice.docType;
  const money = (minor: number) => InvoiceMath.money(minor, invoice.currency);
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const isInvoice = docType === "invoice";
  const bankRows = isInvoice && invoice.bank ? InvoiceEmails.bankRows(invoice.bank) : [];
  const payOnline = InvoiceEmails.payOnline(invoice, settings);
  const hasPeriod = invoice.items.some((item) => item.period);
  const taxDoc = invoice.trn !== "" && invoice.taxRateBp > 0;
  const consultancy = invoice.layout === "consultancy";
  const settled = invoice.paidMinor + invoice.creditedMinor;
  /** Negative when a credit note on a paid invoice leaves money owed back to the client. */
  const remaining = invoice.totalMinor - settled;
  const number = invoice.number ?? "Assigned on issue";
  const related =
    invoice.relatedNumber &&
    (docType === "credit_note" ? (["Against invoice", invoice.relatedNumber] as const) : docType === "invoice" ? (["From quote", invoice.relatedNumber] as const) : null);

  return (
    <DocumentFrame title={DocumentFormat.title(invoice)} number={invoice.number} stamp={DocumentFormat.stamp(invoice, today)} settings={settings}>
      <section className="grid gap-8 text-sm leading-relaxed sm:grid-cols-[1fr_1fr_auto] print:grid-cols-[1fr_1fr_auto]">
        <FromBlock settings={settings} trn={invoice.trn} />
        <div>
          <h2 className={LABEL}>{docType === "quote" ? "Prepared for" : "Bill to"}</h2>
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
            <dt className={ROW_LABEL}>{SettingsContract.DOCUMENT_TYPES[docType]} no.</dt>
            <dd className="font-semibold whitespace-nowrap text-slate-900">{number}</dd>
            <dt className={ROW_LABEL}>Issued</dt>
            <dd className="font-semibold text-slate-900">{invoice.issueDate ? InvoiceEmails.day(invoice.issueDate) : "On issue"}</dd>
            {docType !== "credit_note" && (
              <>
                <dt className={ROW_LABEL}>{docType === "quote" ? "Valid until" : "Due"}</dt>
                <dd className="font-semibold text-slate-900">{InvoiceEmails.day(invoice.dueDate)}</dd>
              </>
            )}
            {isInvoice && (
              <>
                <dt className={ROW_LABEL}>Terms</dt>
                <dd className="font-semibold text-slate-900">{InvoiceContract.PAYMENT_TERMS[invoice.paymentTerms]}</dd>
              </>
            )}
            {related && (
              <>
                <dt className={ROW_LABEL}>{related[0]}</dt>
                <dd className="font-semibold whitespace-nowrap text-slate-900">{related[1]}</dd>
              </>
            )}
            <dt className={ROW_LABEL}>Currency</dt>
            <dd className="font-semibold text-slate-900">{invoice.currency}</dd>
          </dl>
        </div>
      </section>

      {consultancy && (
        <>
          <TextBlock title="Scope" text={invoice.sections.scope} className="mt-10 print:mt-6" />
          <TextBlock title="Deliverables" text={invoice.sections.deliverables} />
        </>
      )}

      <div className="mt-10 overflow-x-auto print:mt-6 print:overflow-visible">
        {consultancy && <h2 className={`${LABEL} mb-3`}>Fees</h2>}
        <table className="w-full min-w-[540px] border-t-2 border-canvas text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className={`${TH} w-14`}>No.</th>
              <th className={TH}>Description</th>
              {hasPeriod && <th className={TH}>{consultancy ? "Date" : "Period"}</th>}
              <th className={`${TH} text-right`}>Qty</th>
              <th className={`${TH} text-right`}>Unit price</th>
              {taxDoc && <th className={`${TH} text-right`}>VAT</th>}
              <th className={`${TH} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index} className="border-b border-slate-200 align-top">
                <td className="px-3 py-4 print:py-2.5 font-mono text-slate-500">{String(index + 1).padStart(2, "0")}</td>
                <td className="px-3 py-4 print:py-2.5">
                  <p className="font-semibold text-slate-900">{item.description}</p>
                  {item.detail && <p className="mt-0.5 text-slate-500">{item.detail}</p>}
                </td>
                {hasPeriod && <td className="px-3 py-4 print:py-2.5 whitespace-nowrap text-slate-900">{item.period ? InvoiceEmails.period(item.period) : "—"}</td>}
                <td className="px-3 py-4 print:py-2.5 text-right whitespace-nowrap tabular-nums">
                  {item.quantity}
                  {item.unit && <span className="ml-1 text-xs text-slate-500">{SettingsContract.unitLabel(settings, item.unit, item.quantity)}</span>}
                </td>
                <td className="px-3 py-4 print:py-2.5 text-right whitespace-nowrap tabular-nums">{money(item.unitMinor)}</td>
                {taxDoc && <td className="px-3 py-4 print:py-2.5 text-right whitespace-nowrap tabular-nums">{InvoiceMath.percent(invoice.taxRateBp)}%</td>}
                <td className="px-3 py-4 print:py-2.5 text-right font-bold whitespace-nowrap text-slate-900 tabular-nums">{money(item.amountMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-10 grid gap-8 print:mt-6 sm:grid-cols-[1fr_19rem] sm:gap-16 print:grid-cols-[1fr_19rem] print:gap-16">
        <div className="break-inside-avoid">
          {(bankRows.length > 0 || invoice.paymentInstructions || payOnline) && isInvoice && (
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
              {payOnline && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-6 text-sm">
                  <dt className={ROW_LABEL}>Pay online</dt>
                  <dd className="break-all">
                    <a href={invoice.paymentLink} className="text-xs font-semibold text-canvas underline">
                      {invoice.paymentLink}
                    </a>
                    {settings.card.note && <span className="mt-0.5 block text-xs text-slate-500">{settings.card.note}</span>}
                  </dd>
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
          {isInvoice && settled > 0 && (
            <>
              <dt className="text-slate-500">Total</dt>
              <dd className="text-right text-slate-500">{money(invoice.totalMinor)}</dd>
              {invoice.paidMinor > 0 && (
                <>
                  <dt className="text-emerald-700">Paid to date</dt>
                  <dd className="text-right text-emerald-700">−{money(invoice.paidMinor)}</dd>
                </>
              )}
              {invoice.creditedMinor > 0 && (
                <>
                  <dt className="text-emerald-700">Credited</dt>
                  <dd className="text-right text-emerald-700">−{money(invoice.creditedMinor)}</dd>
                </>
              )}
            </>
          )}
          <div className="col-span-2 mt-1 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
            <dt className="font-mono text-[11px] font-semibold tracking-[0.2em] whitespace-nowrap text-slate-900 uppercase">
              {isInvoice ? (remaining < 0 ? "Credit owed" : settled > 0 ? "Balance due" : "Total due") : docType === "quote" ? "Quote total" : "Credit total"}
            </dt>
            <dd className="font-serif text-2xl font-bold whitespace-nowrap text-canvas">{money(isInvoice ? Math.abs(remaining) : invoice.totalMinor)}</dd>
          </div>
        </dl>
      </section>

      {consultancy && (
        <>
          <TextBlock title="Expenses" text={invoice.sections.expenses} />
          <TextBlock title="Assumptions" text={invoice.sections.assumptions} />
        </>
      )}
      <TextBlock title="Notes" text={invoice.notes} />
      <ThankYou firstName={InvoiceEmails.firstName(invoice.clientName)} message={THANKS[docType](settings.business.name)} settings={settings} />
      <TermsBlock text={settings.documents[docType].terms} />
    </DocumentFrame>
  );
}
