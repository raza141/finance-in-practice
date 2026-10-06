import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { AutoPrint } from "@/domains/courses/components/AutoPrint";
import { InvoiceDocument } from "@/domains/invoices/components/InvoiceDocument";
import { OnePagePrint } from "@/domains/invoices/components/OnePagePrint";
import { PrintButton } from "@/domains/invoices/components/PrintButton";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

/** The page title becomes the PDF's file name: "Invoice FIP-2026-001 - Khawla Abdullah". */
export async function generateMetadata({ params }: PageProps<"/admin/invoice-pdf/[id]">): Promise<Metadata> {
  await AdminAuth.require();
  const invoice = await InvoiceRepository.fromEnv()?.byId((await params).id);
  const name = invoice ? `Invoice ${invoice.number ?? "draft"} - ${invoice.clientName}` : "Invoice";
  return { title: { absolute: name }, robots: { index: false, follow: false } };
}

/** An invoice opened straight into the print dialog, to "Save as PDF" for WhatsApp. Admins only; doesn't count as a client view. */
export default async function InvoicePdfPage({ params }: PageProps<"/admin/invoice-pdf/[id]">) {
  await AdminAuth.require();
  const [invoice, settings] = await Promise.all([InvoiceRepository.fromEnv()?.byId((await params).id), SettingsRepository.load()]);
  if (!invoice) notFound();

  return (
    // -mt-20 cancels the root <main> padding reserved for the (hidden) site navbar.
    <div className="-mt-20 min-h-screen bg-slate-200 px-4 py-10 print:m-0 print:bg-white print:p-0">
      <OnePagePrint />
      <AutoPrint />
      <p className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 text-sm text-slate-700 print:hidden">
        Choose “Save as PDF” in the print dialog, then send the file on WhatsApp.
        <PrintButton className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700" />
      </p>
      <InvoiceDocument invoice={invoice} settings={settings} />
    </div>
  );
}
