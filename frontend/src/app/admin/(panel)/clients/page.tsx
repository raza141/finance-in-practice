import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ClientForm } from "@/domains/invoices/components/BillingForms";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";

export const metadata: Metadata = { title: "Clients" };

export default async function AdminClientsPage() {
  await AdminAuth.require();
  const repo = ClientRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const clients = await repo.all();

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-normal tracking-tight italic">Clients</h1>
      <p className="mt-2 text-sm text-muted">Saved clients to bill. Pick one on an invoice to fill in the “Bill to” details.</p>

      <details className="mt-8 rounded-lg border border-line p-5" open={clients.length === 0}>
        <summary className="cursor-pointer text-sm text-quant">+ New client</summary>
        <div className="mt-5">
          <ClientForm />
        </div>
      </details>

      {clients.length === 0 ? (
        <p className="mt-10 text-muted">No clients yet. You can also save one from the invoice form.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-[0.18em] text-muted uppercase">
                <th className="py-2 pr-4 font-normal">Name</th>
                <th className="py-2 pr-4 font-normal">Email</th>
                <th className="py-2 pr-4 font-normal">Phone</th>
                <th className="py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-line/60 hover:bg-surface/60">
                  <td className="py-2.5 pr-4">
                    <Link href={`/admin/clients/${client.id}`} className="text-quant hover:underline">
                      {client.name}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 text-muted">{client.email}</td>
                  <td className="py-2.5 pr-4 text-muted">{client.phone || "—"}</td>
                  <td className="py-2.5 text-right">
                    <Link href={`/admin/invoices/new?client=${client.id}`} className="text-xs text-muted hover:text-ink">
                      New invoice →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
