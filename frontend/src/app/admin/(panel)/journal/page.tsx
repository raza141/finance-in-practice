import type { Metadata } from "next";
import Link from "next/link";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { createArticle } from "@/domains/journal/actions/articles";
import { ArticleRepository } from "@/domains/journal/server/ArticleRepository";
import { ArticlePolicy } from "@/domains/journal/services/ArticlePolicy";
import { JournalDates } from "@/domains/journal/services/JournalDates";
import { JournalFramework } from "@/domains/journal/services/JournalFramework";
import { JournalTaxonomy } from "@/domains/journal/services/JournalTaxonomy";
import type { ArticleListItem } from "@/domains/journal/types";

export const metadata: Metadata = { title: "Research Terminal" };

const FILTERS = ["all", "review", "draft", "live", "scheduled", "archived"] as const;
type Filter = (typeof FILTERS)[number];

function state(a: ArticleListItem): Exclude<Filter, "all" | "review"> {
  if (a.status === "archived") return "archived";
  if (a.status === "draft") return "draft";
  return a.datePublished && new Date(a.datePublished) > new Date() ? "scheduled" : "live";
}

const BADGE: Record<ReturnType<typeof state>, string> = {
  live: "text-quant",
  scheduled: "text-gold",
  draft: "text-muted",
  archived: "text-muted/60",
};

export default async function AdminJournalPage({ searchParams }: PageProps<"/admin/journal">) {
  const admin = await AdminAuth.require();
  const repo = ArticleRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const raw = (await searchParams).show;
  const filter: Filter = FILTERS.find((f) => f === raw) ?? "all";
  const all = await repo.list(ArticlePolicy.listScope(admin));
  const articles = all.filter((a) => (filter === "all" ? true : filter === "review" ? a.reviewState === "pending" : state(a) === filter));
  const pending = all.filter((a) => a.reviewState === "pending").length;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">Research Terminal</h1>
        <p className="text-sm text-muted">
          {admin.role === "owner" ? "You publish directly; editors' articles wait for your review." : "Submit finished drafts for an owner to review."}
        </p>
      </div>

      <form action={createArticle} className="mt-6 rounded-xl border border-line bg-surface/50 p-5">
        <p className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">New article: choose its format</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {JournalTaxonomy.FORMATS.map((format) => (
            <label key={format} className="cursor-pointer rounded-lg border border-line p-3 has-checked:border-quant has-checked:bg-quant/10">
              <input type="radio" name="format" value={format} defaultChecked={format === "Explainer"} className="sr-only" />
              <span className="block text-sm font-semibold text-ink">{format}</span>
              <span className="mt-1 block text-[11px] leading-snug text-muted">
                {JournalFramework.sections(format)
                  .map((s) => s.label)
                  .join(" → ")}
              </span>
            </label>
          ))}
        </div>
        <PendingButton pendingLabel="Creating…" className="mt-4 h-10 rounded-md bg-gold px-4 text-sm font-semibold text-canvas transition-colors hover:bg-gold-bright">
          + Start draft
        </PendingButton>
      </form>

      <nav aria-label="Filter" className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/journal" : `/admin/journal?show=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === f ? "border-quant bg-quant/15 text-quant" : "border-line text-muted hover:text-ink"}`}
          >
            {f === "review" ? `In review${pending ? ` (${pending})` : ""}` : f}
          </Link>
        ))}
      </nav>

      {articles.length === 0 ? (
        <p className="mt-10 text-muted">No articles here yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {articles.map((a) => {
            const s = state(a);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
                <div className="min-w-0 flex-1 basis-72">
                  <Link href={`/admin/journal/${a.id}`} className="font-semibold text-ink hover:text-quant">
                    {a.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {a.format} · {a.authorName} · edited {JournalDates.stamp(a.updatedAt)} · /journal/{a.slug}
                  </p>
                </div>
                <div className="flex w-56 flex-col items-end gap-0.5 text-[11px] tracking-wider uppercase">
                  <span className={BADGE[s]}>
                    {s === "live" ? "● Live" : s === "scheduled" ? `◷ ${JournalDates.stamp(a.datePublished!)}` : s === "draft" ? "○ Draft" : "Archived"}
                  </span>
                  {a.reviewState === "pending" && <span className="text-gold">In review</span>}
                  {a.reviewState === "changes-requested" && <span className="text-red-300">Changes requested</span>}
                  {a.hasUnpublishedChanges && s === "live" && <span className="text-muted">Unpublished edits</span>}
                </div>
                {s === "live" && (
                  <Link href={`/journal/${a.slug}`} target="_blank" className="text-sm text-quant hover:underline">
                    View ↗
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
