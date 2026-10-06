import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { AutoPrint } from "@/domains/courses/components/AutoPrint";
import { DocumentView } from "@/domains/invoices/components/DocumentView";
import { OnePagePrint } from "@/domains/invoices/components/OnePagePrint";
import { PrintButton } from "@/domains/invoices/components/PrintButton";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { DocumentFormat } from "@/domains/invoices/services/DocumentFormat";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

/** The page title becomes the PDF's file name: "Invoice-FIP-INV-2026-0002-Khawla-Abdullah". */
export async function generateMetadata({ params }: PageProps<"/admin/invoice-pdf/[id]">): Promise<Metadata> {
  await AdminAuth.require();
  const doc = await InvoiceRepository.fromEnv()?.byId((await params).id);
  return { title: { absolute: doc ? DocumentFormat.filename(doc) : "Document" }, robots: { index: false, follow: false } };
}

/** A document opened straight into the print dialog, to "Save as PDF" for WhatsApp. Admins only; doesn't count as a client view. */
export default async function DocumentPdfPage({ params }: PageProps<"/admin/invoice-pdf/[id]">) {
  const admin = await AdminAuth.require();
  const repo = InvoiceRepository.fromEnv();
  const [doc, settings] = await Promise.all([repo?.byId((await params).id), SettingsRepository.load()]);
  if (!repo || !doc) notFound();
  if (doc.status !== "draft") await repo.logEvent(doc.id, admin.name || admin.email, "shared", "PDF downloaded");

  return (
    // -mt-20 cancels the root <main> padding reserved for the (hidden) site navbar.
    <div className="-mt-20 min-h-screen bg-slate-200 px-4 py-10 print:m-0 print:bg-white print:p-0">
      <OnePagePrint />
      <AutoPrint />
      <p className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 text-sm text-slate-700 print:hidden">
        Choose “Save as PDF” in the print dialog, then send the file on WhatsApp.
        <PrintButton className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700" />
      </p>
      <DocumentView doc={doc} settings={settings} />
    </div>
  );
}
