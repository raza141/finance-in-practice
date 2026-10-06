import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { DocumentView } from "@/domains/invoices/components/DocumentView";
import { OnePagePrint } from "@/domains/invoices/components/OnePagePrint";
import { PrintButton } from "@/domains/invoices/components/PrintButton";
import { ViewBeacon } from "@/domains/invoices/components/ViewBeacon";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { DocumentAccess } from "@/domains/invoices/services/DocumentAccess";
import { DocumentFormat } from "@/domains/invoices/services/DocumentFormat";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

// Holds a client's personal data: never indexed, and the secret URL never leaks as a referrer.
const PRIVATE = { robots: { index: false, follow: false }, referrer: "no-referrer" } as const;

/** The title is the saved PDF's file name. */
export async function generateMetadata({ params }: PageProps<"/invoice/[token]">): Promise<Metadata> {
  const doc = await InvoiceRepository.fromEnv()?.byToken((await params).token);
  return { ...PRIVATE, title: { absolute: doc && !DocumentAccess.isExpired(doc) ? DocumentFormat.filename(doc) : "Document" } };
}

/** Client-facing document, keyed by an unguessable token (not the sequential number). The link expires after settlement. */
export default async function PublicDocumentPage({ params }: PageProps<"/invoice/[token]">) {
  await connection(); // per request: status changes (paid, void) show immediately
  const [doc, settings] = await Promise.all([InvoiceRepository.fromEnv()?.byToken((await params).token), SettingsRepository.load()]);
  if (!doc) notFound();

  if (DocumentAccess.isExpired(doc)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl">This link has expired</h1>
        <p className="mt-4 text-muted">
          For a new copy of {doc.number ?? "this document"}, contact {settings.business.name} on WhatsApp at {settings.business.phone}
          {settings.business.email ? ` or ${settings.business.email}` : ""}.
        </p>
      </div>
    );
  }

  return (
    // -mt-20 cancels the root <main> padding reserved for the (hidden) site navbar.
    <div className="-mt-20 min-h-screen bg-slate-200 px-4 py-10 print:m-0 print:bg-white print:p-0">
      <OnePagePrint />
      <div className="mx-auto mb-4 flex max-w-3xl justify-end">
        <PrintButton className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700" />
      </div>
      <DocumentView doc={doc} settings={settings} />
      <ViewBeacon token={doc.token} />
    </div>
  );
}
