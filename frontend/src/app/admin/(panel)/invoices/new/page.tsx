import type { Metadata } from "next";
import Link from "next/link";

import { ResendClient } from "@/core/email/ResendClient";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { EmailNotConfigured } from "@/domains/invoices/components/AdminBits";
import { InvoiceForm } from "@/domains/invoices/components/InvoiceForm";
import { BookingPrefillLoader } from "@/domains/invoices/server/BookingPrefillLoader";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import type { InvoiceInput } from "@/domains/invoices/types";

export const metadata: Metadata = { title: "New invoice" };

/** Blank for an offline client, or prefilled from a Cal.com booking (`?booking=<uid>`, linked from Schedule). */
export default async function NewInvoicePage({ searchParams }: PageProps<"/admin/invoices/new">) {
  await AdminAuth.require();
  const [{ prefill, error }, paymentInstructions] = await Promise.all([
    BookingPrefillLoader.load((await searchParams).booking),
    InvoiceRepository.fromEnv()?.lastPaymentInstructions() ?? "",
  ]);

  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const initial: InvoiceInput = {
    bookingUid: prefill?.bookingUid ?? null,
    clientName: prefill?.clientName ?? "",
    clientEmail: prefill?.clientEmail ?? "",
    currency: "AED",
    items: prefill
      ? [
          {
            description: `${prefill.topic}: ${prefill.durationMinutes}-minute session, ${InvoiceEmails.day(prefill.date)}`.slice(0, InvoiceContract.LIMITS.description),
            quantity: 1,
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
    paymentInstructions,
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
      <InvoiceForm initial={initial} emailEnabled={ResendClient.fromEnv() !== null} />
    </div>
  );
}
