import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ModerationCard } from "@/domains/testimonials/components/ModerationCard";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";
import { TestimonialContract } from "@/domains/testimonials/services/TestimonialContract";

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
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">Testimonials</h1>
        <Link href="/testimonials/submit" className="text-sm text-quant hover:underline">
          Public form ↗
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Only approved testimonials appear on the home page. Changes go live immediately.
      </p>

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
