import type { BillingSettings } from "@/domains/settings/types";

import { InvoiceEmails } from "../services/InvoiceEmails";
import type { StatementSection } from "../services/Ledger";
import { InvoiceMath } from "../services/InvoiceMath";
import type { Client } from "../types";
import { DocumentFrame, FromBlock, LABEL, ROW_LABEL } from "./DocumentParts";

const KIND: Record<StatementSection["rows"][number]["kind"], string> = {
  invoice: "Invoice",
  receipt: "Receipt (paid on the spot)",
  credit_note: "Credit note",
  payment: "Payment received",
};
const TH = "px-3 py-3 font-mono text-[11px] font-semibold tracking-[0.2em] text-slate-900 uppercase";

/** A client's account for one month: opening balance, charges and credits, closing balance; per currency. */
export function StatementDocument({ client, month, sections, settings }: { client: Client; month: string; sections: StatementSection[]; settings: BillingSettings }) {
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  return (
    <DocumentFrame title="Statement" number={monthName} settings={settings}>
      <section className="grid gap-8 text-sm leading-relaxed sm:grid-cols-2 print:grid-cols-2">
        <FromBlock settings={settings} trn={settings.vat.registered ? settings.vat.trn : ""} />
        <div>
          <h2 className={LABEL}>Account of</h2>
          <p className="mt-3 font-serif text-lg font-bold text-canvas">{client.name}</p>
          <p className="mt-1 text-slate-500">
            {client.address && <span className="block whitespace-pre-line">{client.address}</span>}
            {client.email && <span className="block break-all">{client.email}</span>}
            {client.phone && <span className="block">{client.phone}</span>}
          </p>
        </div>
      </section>

      {sections.length === 0 && <p className="mt-10 text-sm text-slate-500">No activity and no balance in {monthName}.</p>}
      {sections.map((section) => {
        const money = (minor: number) => InvoiceMath.money(minor, section.currency);
        return (
          <section key={section.currency} className="mt-10 break-inside-avoid">
            <table className="w-full border-t-2 border-canvas text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className={TH}>Date</th>
                  <th className={TH}>Item</th>
                  <th className={`${TH} text-right`}>Charges</th>
                  <th className={`${TH} text-right`}>Credits</th>
                  <th className={`${TH} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="px-3 py-3 text-slate-500" colSpan={4}>
                    Opening balance ({section.currency})
                  </td>
                  <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{money(section.openingMinor)}</td>
                </tr>
                {section.rows.map((row, index) => (
                  <tr key={index} className="border-b border-slate-200">
                    <td className="px-3 py-3 whitespace-nowrap text-slate-500">{InvoiceEmails.day(row.date)}</td>
                    <td className="px-3 py-3">
                      {KIND[row.kind]} <span className="font-mono whitespace-nowrap text-slate-500">{row.number}</span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{row.debitMinor ? money(row.debitMinor) : ""}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap text-emerald-700 tabular-nums">{row.creditMinor ? `−${money(row.creditMinor)}` : ""}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{money(row.balanceMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end">
              <dl className="flex items-center gap-6 rounded-md border border-slate-200 border-l-4 border-l-gold bg-slate-50 px-6 py-4">
                <dt className={ROW_LABEL}>{section.closingMinor < 0 ? "In credit" : "Balance due"}</dt>
                <dd className="font-serif text-2xl font-bold text-canvas">{money(Math.abs(section.closingMinor))}</dd>
              </dl>
            </div>
          </section>
        );
      })}
      <p className="mt-10 text-xs text-slate-500">Questions about this statement are handled by WhatsApp at {settings.business.phone}.</p>
    </DocumentFrame>
  );
}
