import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { SettingsForm } from "@/domains/settings/components/SettingsForm";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await AdminAuth.requireOwner();
  const settings = await SettingsRepository.load();
  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-normal tracking-tight italic">Settings</h1>
      <p className="mt-2 text-sm text-muted">Business details, VAT, numbering and the client-facing text on invoices, receipts, quotes and credit notes.</p>
      <p className="mt-2 text-sm">
        <Link href="/admin/settings/terms" className="text-quant hover:underline">
          Terms and conditions
        </Link>
        <span className="text-muted"> — the /terms page students accept</span>
      </p>
      <div className="mt-8">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
