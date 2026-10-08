import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import type { BillingSettings } from "@/domains/settings/types";

import { DocumentFormat } from "../services/DocumentFormat";
import { InvoiceContract } from "../services/InvoiceContract";
import { InvoiceEmails } from "../services/InvoiceEmails";
import { InvoiceMath } from "../services/InvoiceMath";
import type { Invoice } from "../types";
import { DocumentFrame, FromBlock, LABEL, ROW_LABEL, TermsBlock, ThankYou } from "./DocumentParts";

/**
 * A receipt on one compact page: a Quick Receipt (one session paid on the
 * spot, no invoice) or the receipt issued when a payment is recorded on an invoice.
 */
export function ReceiptDocument({ receipt, settings }: { receipt: Invoice; settings: BillingSettings }) {
  const payment = receipt.receiptPayment;
  const amount = payment?.amountMinor ?? receipt.totalMinor;
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const service = receipt.items.map((item) => item.description).join(", ");
  const rows: [string, string][] = [
    ["Receipt no.", receipt.number ?? "Assigned on issue"],
    ["Paid on", InvoiceEmails.day(payment?.paidOn ?? receipt.dueDate)],
    ["Service", service],
    ...(receipt.relatedNumber ? ([["For invoice", receipt.relatedNumber]] as [string, string][]) : []),
    ["Method", payment ? InvoiceContract.PAYMENT_METHODS[payment.method] : "—"],
    ...(payment?.reference ? ([["Reference", payment.reference]] as [string, string][]) : []),
    ...(receipt.trn && receipt.taxRateBp > 0
      ? ([["VAT included", `${InvoiceMath.money(receipt.taxMinor, receipt.currency)} (${InvoiceMath.percent(receipt.taxRateBp)}%)`]] as [
          string,
          string,
        ][])
      : []),
  ];

  return (
    <DocumentFrame title={DocumentFormat.title(receipt)} number={receipt.number} stamp={DocumentFormat.stamp(receipt, today)} settings={settings}>
      <section className="grid gap-8 text-sm leading-relaxed sm:grid-cols-2 print:grid-cols-2">
        <FromBlock settings={settings} trn={receipt.trn} />
        <div>
          <h2 className={LABEL}>Received from</h2>
          <p className="mt-3 font-serif text-lg font-bold text-canvas">{receipt.clientName}</p>
          <p className="mt-1 text-slate-500">
            {receipt.clientEmail && <span className="block break-all">{receipt.clientEmail}</span>}
            {receipt.clientPhone && <span className="block">{receipt.clientPhone}</span>}
          </p>
        </div>
      </section>

      <section className="mt-10 grid gap-8 border-t-2 border-canvas pt-8 print:mt-6 print:pt-6 sm:grid-cols-[1fr_17rem] print:grid-cols-[1fr_17rem]">
        <dl className="grid h-fit grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className={ROW_LABEL}>{label}</dt>
              <dd className="font-semibold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="h-fit rounded-md border border-slate-200 border-l-4 border-l-gold bg-slate-50 p-6">
          <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-slate-900 uppercase">Amount received</p>
          <p className="mt-2 font-serif text-3xl font-bold whitespace-nowrap text-canvas">{InvoiceMath.money(amount, receipt.currency)}</p>
        </div>
      </section>

      <div className="print:mt-auto">
        <ThankYou
          firstName={InvoiceEmails.firstName(receipt.clientName)}
          message={
            receipt.relatedNumber
              ? `Payment received with thanks. ${settings.business.name} confirms the amount above as received against invoice ${receipt.relatedNumber}.`
              : `Payment received with thanks. ${settings.business.name} confirms the amount above as paid for the service listed.`
          }
          settings={settings}
        />
        <TermsBlock text={settings.documents.receipt.terms} />
      </div>
    </DocumentFrame>
  );
}
