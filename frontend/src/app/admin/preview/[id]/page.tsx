import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { siteConfig } from "@/core/config/site";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ArticleView } from "@/domains/journal/components/ArticleView";
import { ArticleRepository } from "@/domains/journal/server/ArticleRepository";
import { ArticlePolicy } from "@/domains/journal/services/ArticlePolicy";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/** The saved draft rendered exactly as the public page would render it. Admins only, never indexed. */
export default async function PreviewArticlePage({ params }: PageProps<"/admin/preview/[id]">) {
  const admin = await AdminAuth.require();
  const repo = ArticleRepository.fromEnv();
  const article = await repo?.byId((await params).id);
  if (!repo || !article || !ArticlePolicy.canEdit(admin, article)) notFound();

  const doc = article.draft;
  const relatedSlugs = doc.blocks.flatMap((b) => (b.type === "related" ? b.slugs : []));
  const related = await repo.summariesBySlugs(relatedSlugs);

  return (
    <div className="pt-20">
      <p className="sticky top-0 z-10 bg-gold/90 py-1 text-center font-mono text-[11px] tracking-wider text-canvas uppercase">Draft preview · not public</p>
      <ArticleView
        doc={doc}
        authorName={article.authorName}
        datePublished={article.datePublished ?? new Date().toISOString()}
        dateModified={new Date().toISOString()}
        related={related}
        url={`${siteConfig.url}/journal/${doc.slug}`}
      />
    </div>
  );
}
