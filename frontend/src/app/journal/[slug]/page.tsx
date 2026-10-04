import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/core/components/seo/JsonLd";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { siteConfig } from "@/core/config/site";
import { StructuredData } from "@/core/seo/StructuredData";
import { JournalCatalog } from "@/domains/journal/services/JournalCatalog";

const catalog = new JournalCatalog();

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return catalog.all().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/journal/[slug]">): Promise<Metadata> {
  const article = catalog.bySlug((await params).slug);
  if (!article) return { title: "Article not found", robots: { index: false } };
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: `/journal/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.summary,
      url: `${siteConfig.url}/journal/${article.slug}`,
      publishedTime: article.publishedAt,
    },
  };
}

export default async function ArticlePage({ params }: PageProps<"/journal/[slug]">) {
  const article = catalog.bySlug((await params).slug);
  if (!article) notFound();

  return (
    <article className="page-container max-w-3xl pt-14 pb-20 lg:pt-20">
      <JsonLd data={StructuredData.article(article)} />
      <Link href="/journal" className="font-mono text-xs tracking-[0.16em] text-quant uppercase hover:text-ink">
        ← Journal
      </Link>
      <h1 className="mt-6 text-4xl leading-tight font-black sm:text-5xl">{article.title}</h1>
      <p className="mt-5 font-mono text-xs tracking-[0.16em] text-muted uppercase">
        <time dateTime={article.publishedAt}>{JournalCatalog.date(article.publishedAt)}</time>
        {" · "}
        {article.tags.join(" · ")}
      </p>
      <p className="mt-8 text-lg leading-relaxed text-muted">{article.summary}</p>

      <div className="mt-10 space-y-10 border-t border-line pt-10">
        {article.sections.map((section, i) => (
          <section key={section.heading ?? i}>
            {section.heading && <h2 className="text-2xl font-bold">{section.heading}</h2>}
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-4 leading-relaxed text-ink/90">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-14 rounded-xl border border-line bg-surface p-6">
        <p className="font-semibold">Want this explained 1-on-1?</p>
        <p className="mt-2 text-sm text-muted">Free 30-minute call to check fit, schedule and prerequisites.</p>
        <ButtonLink href={siteConfig.navCta.href} className="mt-4">
          {siteConfig.navCta.label}
        </ButtonLink>
      </div>
    </article>
  );
}
