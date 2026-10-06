import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { AutoPrint } from "@/domains/courses/components/AutoPrint";
import { OnePagePrint } from "@/domains/invoices/components/OnePagePrint";
import { PrintButton } from "@/domains/invoices/components/PrintButton";
import { StatementDocument } from "@/domains/invoices/components/StatementDocument";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { Ledger } from "@/domains/invoices/services/Ledger";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

async function monthOf(searchParams: PageProps<"/admin/statement/[clientId]">["searchParams"]): Promise<string> {
  const month = (await searchParams).month;
  return typeof month === "string" && MONTH.test(month) ? month : new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today().slice(0, 7);
}

/** File name: "Statement-2026-10-Khawla-Abdullah". */
export async function generateMetadata({ params, searchParams }: PageProps<"/admin/statement/[clientId]">): Promise<Metadata> {
  await AdminAuth.require();
  const client = await ClientRepository.fromEnv()?.byId((await params).clientId);
  const name = client?.name.trim().replace(/[^\p{L}\p{N}]+/gu, "-") ?? "client";
  return { title: { absolute: `Statement-${await monthOf(searchParams)}-${name}` }, robots: { index: false, follow: false } };
}

/** A client's monthly statement, opened straight into the print dialog. Admins only. */
export default async function StatementPage({ params, searchParams }: PageProps<"/admin/statement/[clientId]">) {
  await AdminAuth.require();
  const { clientId } = await params;
  const [client, entries, settings] = await Promise.all([
    ClientRepository.fromEnv()?.byId(clientId),
    InvoiceRepository.fromEnv()?.ledger(clientId) ?? [],
    SettingsRepository.load(),
  ]);
  if (!client) notFound();
  const month = await monthOf(searchParams);

  return (
    <div className="-mt-20 min-h-screen bg-slate-200 px-4 py-10 print:m-0 print:bg-white print:p-0">
      <OnePagePrint />
      <AutoPrint />
      <p className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 text-sm text-slate-700 print:hidden">
        Choose “Save as PDF” in the print dialog.
        <PrintButton className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700" />
      </p>
      <StatementDocument client={client} month={month} sections={Ledger.statement(entries, month)} settings={settings} />
    </div>
  );
}
