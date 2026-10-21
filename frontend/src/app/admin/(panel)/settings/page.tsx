import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { SettingsForm } from "@/domains/settings/components/SettingsForm";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";
import { PageHeader, SECONDARY_ACTION } from "@/domains/admin/components/PageHeader";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await AdminAuth.requireOwner();
  const settings = await SettingsRepository.load();
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Settings"
        description="Business details, VAT, numbering and the client-facing text on invoices, receipts, quotes and credit notes."
        actions={
          <Link href="/admin/settings/terms" className={SECONDARY_ACTION}>
            Terms and conditions
          </Link>
        }
      />
      <div className="mt-8">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
