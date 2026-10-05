import type { Metadata } from "next";
import Link from "next/link";

import { ResendClient } from "@/core/email/ResendClient";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { EmailNotConfigured } from "@/domains/invoices/components/AdminBits";
import { InvoiceForm } from "@/domains/invoices/components/InvoiceForm";
import { BookingPrefillLoader } from "@/domains/invoices/server/BookingPrefillLoader";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { InvoiceFormLoader } from "@/domains/invoices/server/InvoiceFormLoader";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import type { InvoiceInput } from "@/domains/invoices/types";

export const metadata: Metadata = { title: "New invoice" };

/**
 * Blank for an offline client, for a saved client (`?client=<id>`), or
 * prefilled from a Cal.com booking (`?booking=<uid>`, linked from Schedule).
 * The default bank account is preselected.
 */
export default async function NewInvoicePage({ searchParams }: PageProps<"/admin/invoices/new">) {
  await AdminAuth.require();
  const query = await searchParams;
  const clients = ClientRepository.fromEnv();
  const [{ prefill, error }, options] = await Promise.all([BookingPrefillLoader.load(query.booking), InvoiceFormLoader.options()]);
  // A booking by someone already saved links to that client.
  const client =
    (typeof query.client === "string" && (await clients?.byId(query.client))) ||
    (prefill?.clientEmail && (await clients?.byEmail(prefill.clientEmail))) ||
    null;

  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const initial: InvoiceInput = {
    bookingUid: prefill?.bookingUid ?? null,
    clientId: client?.id ?? null,
    clientName: client?.name ?? prefill?.clientName ?? "",
    clientEmail: client?.email ?? prefill?.clientEmail ?? "",
    clientPhone: client?.phone ?? "",
    clientAddress: client?.address ?? "",
    currency: client?.planCurrency ?? "AED",
    items: client?.courses.length
      ? InvoiceContract.planItems(client)
      : prefill
      ? [
          {
            description: prefill.topic.slice(0, InvoiceContract.LIMITS.description),
            detail: `${prefill.durationMinutes}-minute session, ${InvoiceEmails.day(prefill.date)}`,
            unit: "hour",
            quantity: Math.round((prefill.durationMinutes / 60) * 100) / 100,
            unitMinor: 0,
            amountMinor: 0,
          },
        ]
      : [],
    discountMinor: 0,
    taxRateBp: 0,
    trn: "",
    dueDate: ZonedCalendar.addDays(today, 7),
    notes: "",
    paymentInstructions: "",
    bankAccountId: options.banks.find((bank) => bank.isDefault)?.id ?? null,
  };

  return (
    <div className="max-w-4xl">
      <Link href="/admin/invoices" className="text-sm text-muted hover:text-ink">
        ← Invoices
      </Link>
      <h1 className="mt-3 text-3xl font-normal tracking-tight italic">New invoice</h1>
      <p className="mt-2 mb-6 text-sm text-muted">
        {prefill ? `Prefilled from the Cal.com booking with ${prefill.clientName || "this client"}.` : "Saved as a draft until you issue it."}
      </p>
      <div className="mb-8 grid gap-3">
        {error && (
          <p role="alert" className="text-sm text-gold">
            {error}
          </p>
        )}
        {!ResendClient.fromEnv() && <EmailNotConfigured />}
      </div>
      <InvoiceForm initial={initial} options={options} emailEnabled={ResendClient.fromEnv() !== null} />
    </div>
  );
}
