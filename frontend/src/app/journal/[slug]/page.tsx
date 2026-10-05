import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { JsonLd } from "@/core/components/seo/JsonLd";
import { siteConfig } from "@/core/config/site";
import { StructuredData } from "@/core/seo/StructuredData";
import { ArticleView } from "@/domains/journal/components/ArticleView";
import { ArticleRepository } from "@/domains/journal/server/ArticleRepository";

// Rendered on first request and cached (ISR); publishing revalidates it at
// once. Five minutes is how late a scheduled article can go live.
export const revalidate = 300;

export function generateStaticParams(): { slug: string }[] {
  return [];
}

/** Shared by generateMetadata and the page, so each request queries once. */
const loadArticle = cache(async (slug: string) => {
  try {
    return (await ArticleRepository.fromEnv()?.publishedBySlug(slug)) ?? null;
  } catch (error) {
    console.error("journal: could not load article", error);
    return null;
  }
});

export async function generateMetadata({ params }: PageProps<"/journal/[slug]">): Promise<Metadata> {
  const article = await loadArticle((await params).slug);
  if (!article) return { title: "Article not found", robots: { index: false } };
  const { doc } = article;
  const url = `${siteConfig.url}/journal/${doc.slug}`;
  const image = doc.seo.ogImage || doc.featuredImage?.url;
  return {
    title: { absolute: `${doc.seo.title || doc.title} | ${siteConfig.name}` },
    description: doc.seo.description || doc.excerpt,
    keywords: doc.tags,
    authors: [{ name: article.authorName }],
    alternates: { canonical: doc.seo.canonical || `/journal/${doc.slug}` },
    openGraph: {
      type: "article",
      title: doc.seo.ogTitle || doc.title,
      description: doc.seo.ogDescription || doc.seo.description || doc.excerpt,
      url,
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
      authors: [article.authorName],
      section: doc.category ?? undefined,
      tags: doc.tags,
      ...(image && { images: [{ url: image, alt: doc.featuredImage?.alt ?? doc.title }] }),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: doc.seo.ogTitle || doc.title, description: doc.seo.description || doc.excerpt },
  };
}

export default async function ArticlePage({ params }: PageProps<"/journal/[slug]">) {
  const article = await loadArticle((await params).slug);
  if (!article) notFound();

  const relatedSlugs = article.doc.blocks.flatMap((b) => (b.type === "related" ? b.slugs : []));
  const related = relatedSlugs.length ? ((await ArticleRepository.fromEnv()?.summariesBySlugs(relatedSlugs)) ?? []) : [];

  return (
    <>
      <JsonLd data={StructuredData.article(article)} />
      <ArticleView
        doc={article.doc}
        authorName={article.authorName}
        datePublished={article.datePublished}
        dateModified={article.dateModified}
        related={related}
        url={`${siteConfig.url}/journal/${article.doc.slug}`}
      />
    </>
  );
}
