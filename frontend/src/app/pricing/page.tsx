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
        <section aria-labelledby="price-list" className="mt-16 max-w-3xl">
          <h2 id="price-list" className="text-2xl font-bold">
            All prices
          </h2>
          {(["exam", "university"] as const).map((audience) => {
            const rows = packages.filter((p) => p.audience === audience && !PackageTable.isCustom(p));
            if (rows.length === 0) return null;
            return (
              <table key={audience} className="mt-6 w-full overflow-hidden rounded-2xl border border-line bg-surface text-sm">
                <caption className="pb-2 text-left font-mono text-[11px] tracking-[0.16em] text-quant uppercase">{PackageTable.AUDIENCE[audience]}</caption>
                <tbody className="divide-y divide-line">
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="p-4 text-left font-semibold">{p.name}</th>
                      <td className="p-4 text-muted">{PackageTable.hours(p)}</td>
                      <td className="tabular-data p-4 text-right font-semibold whitespace-nowrap text-ink">
                        {PackageTable.price(p)} {PackageTable.per(p)}
                        {PackageTable.perHour(p) && <span className="block text-xs font-normal text-muted">{PackageTable.perHour(p)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })}
        </section>
      )}
    </div>
  );
}
