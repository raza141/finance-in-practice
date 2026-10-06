import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { InvoiceDocument } from "@/domains/invoices/components/InvoiceDocument";
import { OnePagePrint } from "@/domains/invoices/components/OnePagePrint";
import { PrintButton } from "@/domains/invoices/components/PrintButton";
import { ViewBeacon } from "@/domains/invoices/components/ViewBeacon";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

// Holds a client's personal data: never indexed, and the secret URL never leaks as a referrer.
export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Client-facing invoice, keyed by an unguessable token (not the sequential number). */
export default async function PublicInvoicePage({ params }: PageProps<"/invoice/[token]">) {
  await connection(); // per request: status changes (paid, void) show immediately
  const [invoice, settings] = await Promise.all([InvoiceRepository.fromEnv()?.byToken((await params).token), SettingsRepository.load()]);
  if (!invoice) notFound();

  return (
    // -mt-20 cancels the root <main> padding reserved for the (hidden) site navbar.
    <div className="-mt-20 min-h-screen bg-slate-200 px-4 py-10 print:m-0 print:bg-white print:p-0">
      <OnePagePrint />
      <div className="mx-auto mb-4 flex max-w-3xl justify-end">
        <PrintButton className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700" />
      </div>
      <InvoiceDocument invoice={invoice} settings={settings} />
      <ViewBeacon token={invoice.token} />
    </div>
  );
}
