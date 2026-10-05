import type { Metadata } from "next";
import Link from "next/link";

import { ArticleRepository } from "@/domains/journal/server/ArticleRepository";
import { JournalDates } from "@/domains/journal/services/JournalDates";
import { JournalTaxonomy } from "@/domains/journal/services/JournalTaxonomy";
import type { ArticleSummary } from "@/domains/journal/types";

export const metadata: Metadata = {
  title: "Research Terminal",
  description: "Research notes on CFA and FRM topics, risk models, valuation, markets in Pakistan and the UAE, and the Python behind them.",
  alternates: { canonical: "/journal" },
};

type Filters = { category?: string; format?: string; audience?: string };

async function load(filters: Filters): Promise<ArticleSummary[]> {
  try {
    return (
      (await ArticleRepository.fromEnv()?.publishedSummaries({
        category: JournalTaxonomy.fromParam(JournalTaxonomy.CATEGORIES, filters.category),
        format: JournalTaxonomy.fromParam(JournalTaxonomy.FORMATS, filters.format),
        audience: JournalTaxonomy.fromParam(JournalTaxonomy.AUDIENCES, filters.audience),
      })) ?? []
    );
  } catch (error) {
    console.error("journal: could not load articles", error);
    return [];
  }
}

/** One filter row: "All" plus each value, as links so filtered views are shareable. */
function FilterRow({ label, name, values, filters }: { label: string; name: keyof Filters; values: readonly string[]; filters: Filters }) {
  const href = (value: string | null) => {
    const next = new URLSearchParams(Object.entries({ ...filters, [name]: value ?? undefined }).filter((e): e is [string, string] => Boolean(e[1])));
    const query = next.toString();
    return query ? `/journal?${query}` : "/journal";
  };
  const current = filters[name];
  const chip = (active: boolean) =>
    `inline-flex h-8 items-center whitespace-nowrap rounded-full border px-3 text-xs transition-colors ${active ? "border-quant bg-quant/15 text-quant" : "border-line text-muted hover:border-quant/50 hover:text-ink"}`;
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-20 shrink-0 font-mono text-[11px] tracking-[0.2em] text-muted uppercase">{label}</span>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link href={href(null)} className={chip(!current)} aria-current={!current ? "true" : undefined}>
          All
        </Link>
        {values.map((v) => {
          const param = JournalTaxonomy.param(v);
          return (
            <Link key={v} href={href(param)} className={chip(current === param)} aria-current={current === param ? "true" : undefined}>
              {v}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const raw = await searchParams;
  const pick = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const filters: Filters = { category: pick("category"), format: pick("format"), audience: pick("audience") };
  const articles = await load(filters);
  const filtered = Boolean(filters.category || filters.format || filters.audience);

  return (
    <>
      <section className="page-container pt-14 pb-10 lg:pt-20">
        <p className="font-mono text-xs tracking-[0.22em] text-quant uppercase">Research Terminal</p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-black sm:text-5xl">Notes from the trading desk of theory</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          Worked explanations of exam topics, risk models, markets and the Python behind them. Every chart carries its source and date.
        </p>
      </section>

      <section aria-label="Filters" className="page-container space-y-3 pb-8">
        <FilterRow label="Topic" name="category" values={JournalTaxonomy.CATEGORIES} filters={filters} />
        <FilterRow label="For" name="audience" values={JournalTaxonomy.AUDIENCES} filters={filters} />
        <FilterRow label="Format" name="format" values={JournalTaxonomy.FORMATS} filters={filters} />
      </section>

      <section aria-label="Articles" className="border-t border-line">
        {articles.length === 0 ? (
          <p className="page-container py-16 text-muted">
            {filtered ? (
              <>
                No articles match these filters yet.{" "}
                <Link href="/journal" className="text-quant hover:underline">
                  Clear filters
                </Link>
              </>
            ) : (
              "The first research notes are on their way."
            )}
          </p>
        ) : (
          <ul className="page-container divide-y divide-line py-6 lg:py-10">
            {articles.map((article) => (
              <li key={article.slug}>
                <Link href={`/journal/${article.slug}`} className="group flex gap-6 py-8">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs tracking-[0.16em] text-muted uppercase">
                      <time dateTime={article.datePublished}>{JournalDates.long(article.datePublished)}</time>
                      {" · "}
                      {[article.format, article.category, article.difficulty].filter(Boolean).join(" · ")}
                    </p>
                    <h2 className="mt-3 text-2xl font-bold group-hover:text-quant sm:text-3xl">{article.title}</h2>
                    <p className="mt-3 max-w-3xl leading-relaxed text-muted">{article.excerpt}</p>
                    {article.tags.length > 0 && <p className="mt-3 font-mono text-xs text-quant/80">{article.tags.map((t) => `#${t}`).join("  ")}</p>}
                  </div>
                  {article.featuredImage && (
                    // eslint-disable-next-line @next/next/no-img-element -- author images from Blob, dimensions unknown
                    <img src={article.featuredImage.url} alt="" loading="lazy" className="hidden aspect-[4/3] w-48 shrink-0 rounded-lg border border-line object-cover sm:block" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
