import Link from "next/link";

import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { JournalCatalog } from "@/domains/journal/services/JournalCatalog";

export function JournalTeaserSection() {
  const articles = new JournalCatalog().all().slice(0, 3);
  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="journal-teaser-heading" data-sequence="reveal" className="border-t border-line">
      <div className="page-container py-20 lg:py-24">
        <SectionHeading id="journal-teaser-heading" eyebrow="Latest from the Journal" title="Worked notes and explainers" />
        <ul data-anim="reveal" className="mt-12 grid gap-4 md:grid-cols-3">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link
                href={`/journal/${article.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-quant/40"
              >
                <time dateTime={article.publishedAt} className="font-mono text-xs text-muted">
                  {JournalCatalog.date(article.publishedAt)}
                </time>
                <h3 className="mt-3 text-lg font-bold group-hover:text-quant">{article.title}</h3>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-muted">{article.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
        <p data-anim="reveal" className="mt-8">
          <Link href="/journal" className="font-mono text-sm text-quant hover:text-ink">
            All articles →
          </Link>
        </p>
      </div>
    </section>
  );
}
