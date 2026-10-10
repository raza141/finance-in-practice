import type { Metadata } from "next";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { LeadRepository } from "@/domains/resources/server/LeadRepository";
import { ResourceCatalog } from "@/domains/resources/services/ResourceCatalog";

export const metadata: Metadata = { title: "Leads" };

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" });

/** People who downloaded a free resource. Owner only: it is a list of email addresses. */
export default async function AdminLeadsPage() {
  await AdminAuth.requireOwner();
  const repo = LeadRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const leads = await repo.recent();
  const optedIn = leads.filter((l) => l.marketingOptIn).length;

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-normal tracking-tight italic">Leads</h1>
      <p className="mt-2 text-sm text-muted">
        {leads.length} download{leads.length === 1 ? "" : "s"} · {optedIn} agreed to exam tips. Only email people who opted in about anything beyond the
        resource they asked for.
      </p>

      {leads.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-line px-6 py-10 text-center text-muted">No leads yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface font-mono text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">Tips</th>
                <th className="px-4 py-3">First</th>
                <th className="px-4 py-3 text-right">Requests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-3">
                    <a href={`mailto:${lead.email}`} className="text-quant hover:underline">
                      {lead.email}
                    </a>
                  </td>
                  <td className="px-4 py-3">{ResourceCatalog.free(lead.resourceId)?.title ?? lead.resourceId}</td>
                  <td className="px-4 py-3 text-muted">{lead.source || "—"}</td>
                  <td className="px-4 py-3">{lead.marketingOptIn ? "Yes" : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{DATE.format(lead.createdAt)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{lead.requests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
