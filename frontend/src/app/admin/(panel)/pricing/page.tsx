import type { Metadata } from "next";

import { PageHeader } from "@/domains/admin/components/PageHeader";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { PackageForm } from "@/domains/packages/components/PackageForm";
import { PackageRepository } from "@/domains/packages/server/PackageRepository";
import { PackageTable } from "@/domains/packages/services/PackageTable";

export const metadata: Metadata = { title: "Pricing" };

const NOTICES: Record<string, string> = { saved: "Package saved: /pricing shows it now.", created: "Package added." };

/** The packages on /pricing. Changing one never changes the agreement of a student already on it. */
export default async function AdminPricingPage({ searchParams }: PageProps<"/admin/pricing">) {
  await AdminAuth.requireOwner();
  const repo = PackageRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const { notice } = await searchParams;
  const packages = await repo.all();

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Pricing"
        description="The packages students choose on /pricing and when they register. The one they pick becomes their agreement; changing a package here never changes agreements already made."
      />
      {typeof notice === "string" && NOTICES[notice] && (
        <p role="status" className="mt-6 rounded-lg border border-quant/40 bg-quant/5 p-3 text-sm text-quant">
          {NOTICES[notice]}
        </p>
      )}
      <ul className="mt-8 grid gap-4">
        {packages.map((p) => (
          <li key={p.id} id={`p-${p.id}`} className="scroll-mt-24">
            <details className="rounded-lg border border-line p-5">
              <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                <span className="text-ink">
                  {p.name}
                  {!p.isActive && <span className="ml-2 text-xs text-muted">Hidden</span>}
                  {p.featured && <span className="ml-2 text-xs text-gold">Recommended</span>}
                  <span className="ml-2 text-xs text-muted">{PackageTable.AUDIENCE[p.audience]}</span>
                </span>
                <span className="text-sm text-muted tabular-nums">
                  {PackageTable.summary(p)}
                  {PackageTable.perHour(p) && ` (${PackageTable.perHour(p)})`}
                </span>
              </summary>
              <div className="mt-5">
                <PackageForm pkg={p} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      <details className="mt-6 rounded-lg border border-dashed border-line p-5" open={packages.length === 0}>
        <summary className="cursor-pointer text-sm text-quant">+ New package</summary>
        <div className="mt-5">
          <PackageForm />
        </div>
      </details>
    </div>
  );
}
