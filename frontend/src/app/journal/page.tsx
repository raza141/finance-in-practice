import type { Metadata } from "next";
import Link from "next/link";

import { JournalCatalog } from "@/domains/journal/services/JournalCatalog";

export const metadata: Metadata = {
  title: "Journal",
  description: "Essays and worked notes on financial theory, risk and Python for finance.",
  alternates: { canonical: "/journal" },
};

export default function JournalPage() {
  const articles = new JournalCatalog().all();

  return (
    <>
      <section className="page-container pt-14 pb-12 lg:pt-20">
        <p className="font-mono text-xs tracking-[0.22em] text-quant uppercase">Journal</p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-black sm:text-5xl">
          Notes from the trading desk of theory
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          Worked explanations of exam topics, risk models and the Python behind them.
        </p>
      </section>

      <section aria-label="Articles" className="border-t border-line">
        <ul className="page-container divide-y divide-line py-6 lg:py-10">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link href={`/journal/${article.slug}`} className="group block py-8">
                <p className="font-mono text-xs tracking-[0.16em] text-muted uppercase">
                  <time dateTime={article.publishedAt}>{JournalCatalog.date(article.publishedAt)}</time>
                  {" · "}
                  {article.tags.join(" · ")}
                </p>
                <h2 className="mt-3 text-2xl font-bold group-hover:text-quant sm:text-3xl">{article.title}</h2>
                <p className="mt-3 max-w-3xl leading-relaxed text-muted">{article.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
