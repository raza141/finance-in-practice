import type { Metadata } from "next";
import Link from "next/link";

import { ResendClient } from "@/core/email/ResendClient";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { BookingCatalog } from "@/domains/booking/services/BookingCatalog";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { EmailNotConfigured } from "@/domains/invoices/components/AdminBits";
import { ConfirmationForm } from "@/domains/invoices/components/ConfirmationForm";
import { BookingPrefillLoader } from "@/domains/invoices/server/BookingPrefillLoader";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";

export const metadata: Metadata = { title: "Send a confirmation" };

/** Branded session confirmation: for offline clients, or to re-send one for a Cal.com booking (`?booking=<uid>`). */
export default async function ConfirmationPage({ searchParams }: PageProps<"/admin/invoices/confirm">) {
  await AdminAuth.requireOwner();
  const { prefill, error } = await BookingPrefillLoader.load((await searchParams).booking);
  const timeZone = prefill?.clientTimeZone ?? InvoiceContract.DEFAULT_TIME_ZONE;
  // Built here so server and browser render the same list; keeps a Cal.com alias (e.g. Asia/Calcutta) selectable.
  const timeZones = [...new Set([timeZone, ...Intl.supportedValuesOf("timeZone")])].sort();
  const emailEnabled = ResendClient.fromEnv() !== null;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/invoices" className="text-sm text-muted hover:text-ink">
        ← Invoices
      </Link>
      <h1 className="mt-3 text-3xl font-normal tracking-tight italic">Send a booking confirmation</h1>
      <p className="mt-2 mb-6 text-sm text-muted">
        Cal.com already emails a confirmation for every website booking. Use this for clients booked outside the website, or to
        re-send a branded confirmation.
      </p>
      <div className="mb-8 grid gap-3">
        {error && (
          <p role="alert" className="text-sm text-gold">
            {error}
          </p>
        )}
        {!emailEnabled && <EmailNotConfigured />}
      </div>
      <ConfirmationForm
        initial={{
          bookingUid: prefill?.bookingUid ?? null,
          clientName: prefill?.clientName ?? "",
          clientEmail: prefill?.clientEmail ?? "",
          clientTimeZone: timeZone,
          date: prefill?.date ?? new ZonedCalendar(timeZone).today(),
          time: prefill?.time ?? "",
          durationMinutes: prefill?.durationMinutes ?? 60,
          topic: prefill?.topic ?? "",
          location: prefill?.location ?? "",
        }}
        timeZones={timeZones}
        topics={new BookingCatalog().tracks().map((t) => t.title)}
        emailEnabled={emailEnabled}
      />
    </div>
  );
}
