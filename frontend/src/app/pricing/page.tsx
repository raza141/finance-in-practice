import type { Metadata } from "next";

import { siteConfig } from "@/core/config/site";
import { PackagePicker } from "@/domains/packages/components/PackagePicker";
import { safely } from "@/domains/students/components/PortalView";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";
import { RegistrationContract } from "@/domains/students/services/RegistrationContract";

export const metadata: Metadata = {
  title: "Pricing and packages",
  description: "1-on-1 CFA® and FRM® coaching packages in Abu Dhabi and online: one hour, 12 hours or 30 hours, or a custom plan. Pick a package and register in one step.",
  alternates: { canonical: "/pricing" },
};

/** /pricing?course=<slug|other>&package=<id>: courses link here with their slug, and the pick stays shareable. */
export default async function PricingPage({ searchParams }: PageProps<"/pricing">) {
  const query = await searchParams;
  const { courses, packages } = (await safely("pricing", async () => ClassroomRepository.fromEnv()?.registrationOptions())) ?? { courses: [], packages: [] };
  const slug = typeof query.course === "string" ? query.course : "";
  const course = slug === "other" ? RegistrationContract.OTHER : (courses.find((c) => c.slug === slug)?.title ?? "");

  return (
    <div className="page-container pt-10 pb-16 lg:pt-12 lg:pb-24">
      <header className="max-w-3xl">
        <h1 className="text-4xl leading-tight font-bold sm:text-5xl">Packages and pricing</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Choose your course and the hours you need, then register on this page. The package you choose is your agreement: no quote to wait for.
        </p>
      </header>
      <div className="mt-10">
        {packages.length === 0 ? (
          <p className="rounded-2xl border border-line p-6 text-muted">Packages are being updated. Message us on WhatsApp and we&rsquo;ll share prices.</p>
        ) : (
          <PackagePicker
            courses={courses}
            packages={packages}
            initialCourse={course}
            initialPackage={typeof query.package === "string" ? query.package : ""}
            delivery={siteConfig.delivery.line}
          />
        )}
      </div>
    </div>
  );
}
