import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ModerationCard } from "@/domains/testimonials/components/ModerationCard";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";
import { TestimonialContract } from "@/domains/testimonials/services/TestimonialContract";
import { PageHeader, SECONDARY_ACTION } from "@/domains/admin/components/PageHeader";

export const metadata: Metadata = { title: "Testimonials" };

export default async function AdminTestimonialsPage({ searchParams }: PageProps<"/admin/testimonials">) {
  await AdminAuth.require();
  const requested = (await searchParams).status;
  const status = TestimonialContract.isStatus(requested) ? requested : "pending";

  const repo = TestimonialRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const [items, counts] = await Promise.all([repo.list(status), repo.counts()]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Testimonials"
        description="Only approved testimonials appear on the home page. Changes go live immediately."
        actions={
          <Link href="/testimonials/submit" target="_blank" className={SECONDARY_ACTION}>
            Open the public form
          </Link>
        }
      />

      <nav aria-label="Filter by status" className="mt-6 flex gap-1 border-b border-line">
        {TestimonialContract.STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/testimonials?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent px-4 py-2 text-sm text-muted capitalize hover:text-ink aria-[current=page]:border-quant aria-[current=page]:text-ink"
          >
            {s} <span className="tabular-nums text-muted">({counts[s]})</span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="mt-10 text-muted">Nothing {status} right now.</p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <ModerationCard testimonial={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
