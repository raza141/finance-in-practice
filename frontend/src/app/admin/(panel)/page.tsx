import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  await AdminAuth.require();
  const repo = TestimonialRepository.fromEnv();
  const counts = repo ? await repo.counts() : null;

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-normal tracking-tight italic">Overview</h1>

      {!counts ? (
        <p role="alert" className="mt-6 text-sm text-gold">
          Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
        </p>
      ) : (
        <section aria-labelledby="testimonials-stats" className="mt-8">
          <h2 id="testimonials-stats" className="font-mono text-xs tracking-[0.22em] text-muted uppercase">
            Testimonials
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {(["pending", "approved", "rejected"] as const).map((status) => (
              <li key={status}>
                <Link
                  href={`/admin/testimonials?status=${status}`}
                  className="block rounded-xl border border-line bg-surface p-5 transition-colors hover:border-quant/50"
                >
                  <span className="block font-mono text-[11px] tracking-[0.22em] text-muted uppercase">{status}</span>
                  <span className={`tabular-data mt-2 block text-3xl ${status === "pending" && counts.pending > 0 ? "text-gold" : "text-ink"}`}>
                    {counts[status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
