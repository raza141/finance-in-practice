import type { Metadata } from "next";

import { siteConfig } from "@/core/config/site";
import { PackagePicker } from "@/domains/packages/components/PackagePicker";
import { PackageTable } from "@/domains/packages/services/PackageTable";
import { safely } from "@/domains/students/components/PortalView";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";

export const metadata: Metadata = {
  title: "Pricing and packages",
  description: "1-on-1 CFA®, FRM® and university finance coaching in Abu Dhabi and online. Clear package prices, or a custom plan. Choose a package and register in one step.",
  alternates: { canonical: "/pricing" },
};

/** /pricing?course=<slug|university|other>&package=<id>: courses link here with their slug, and the pick stays shareable. */
export default async function PricingPage({ searchParams }: PageProps<"/pricing">) {
  const query = await searchParams;
  const { courses, packages } = (await safely("pricing", async () => ClassroomRepository.fromEnv()?.registrationOptions())) ?? { courses: [], packages: [] };
  const slug = typeof query.course === "string" ? query.course : "";
  const key = slug === "other" || slug === "university" ? slug : (courses.find((c) => c.slug === slug)?.title ?? "");

  return (
    <div className="page-container pt-10 pb-16 lg:pt-12 lg:pb-24">
      <header className="max-w-3xl">
        <h1 className="text-4xl leading-tight font-bold text-balance sm:text-5xl">Packages and pricing</h1>
      </header>
      <div className="mt-10">
        {packages.length === 0 ? (
          <p className="rounded-2xl border border-line p-6 text-muted">Packages are being updated. Message us on WhatsApp and we&rsquo;ll share prices.</p>
        ) : (
          <PackagePicker
            courses={courses}
            packages={packages}
            initialKey={key}
            initialPackage={typeof query.package === "string" ? query.package : ""}
            delivery={siteConfig.delivery.line}
          />
        )}
      </div>

      {/* The picker shows prices only after a course is chosen; this list puts every price in the page itself. */}
      {packages.some((p) => !PackageTable.isCustom(p)) && (
        <section aria-labelledby="price-list" className="mt-16">
          <h2 id="price-list" className="text-3xl font-bold">
            All prices
          </h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {(["exam", "university"] as const).map((audience) => {
              const rows = packages.filter((p) => p.audience === audience && !PackageTable.isCustom(p));
              if (rows.length === 0) return null;
              return (
                <div key={audience} className="overflow-hidden rounded-3xl border border-white/10 bg-canvas/70 backdrop-blur">
                  <h3 className="border-b border-line px-6 py-4 font-mono text-[11px] tracking-[0.16em] text-quant uppercase">{PackageTable.AUDIENCE[audience]}</h3>
                  <ul className="divide-y divide-line">
                    {rows.map((p) => (
                      <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-0.5 px-6 py-4 sm:grid-cols-[minmax(0,1fr)_10rem_10.5rem]">
                        <span className="font-semibold text-ink">{p.name}</span>
                        <span className="col-start-1 row-start-2 text-sm text-muted sm:col-start-auto sm:row-start-auto">{PackageTable.hours(p)}</span>
                        <span className="col-start-2 row-span-2 row-start-1 text-right sm:col-start-auto sm:row-span-1 sm:row-start-auto">
                          <span className="tabular-data block font-semibold whitespace-nowrap text-gold">
                            {PackageTable.price(p)} {PackageTable.per(p)}
                          </span>
                          {PackageTable.perHour(p) && <span className="tabular-data block text-xs whitespace-nowrap text-muted">{PackageTable.perHour(p)}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
