import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { QuickReceiptForm } from "@/domains/invoices/components/QuickReceiptForm";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

export const metadata: Metadata = { title: "Quick receipt" };

export default async function QuickReceiptPage() {
  await AdminAuth.requireOwner();
  const [clients, settings] = await Promise.all([ClientRepository.fromEnv()?.all() ?? [], SettingsRepository.load()]);
  return (
    <div className="max-w-3xl">
      <Link href="/admin/invoices" className="text-sm text-muted hover:text-ink">
        ← Billing
      </Link>
      <h1 className="mt-3 text-3xl font-normal tracking-tight italic">Quick receipt</h1>
      <p className="mt-2 mb-8 text-sm text-muted">One session paid on the spot: a numbered receipt, no invoice. The payment is recorded with it.</p>
      <QuickReceiptForm clients={clients} currency={settings.currency} today={new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today()} submissionKey={randomUUID()} />
    </div>
  );
}
