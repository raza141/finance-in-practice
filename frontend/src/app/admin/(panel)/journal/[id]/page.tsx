import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ArticleEditor } from "@/domains/journal/components/admin/ArticleEditor";
import { ArticleRepository } from "@/domains/journal/server/ArticleRepository";
import { ArticleReviewer } from "@/domains/journal/server/ArticleReviewer";
import { ArticlePolicy } from "@/domains/journal/services/ArticlePolicy";

export const metadata: Metadata = { title: "Edit article" };

// The AI review action runs on this page and can take a minute or two.
export const maxDuration = 300;

export default async function EditArticlePage({ params }: PageProps<"/admin/journal/[id]">) {
  const admin = await AdminAuth.require();
  const repo = ArticleRepository.fromEnv();
  const article = await repo?.byId((await params).id);
  if (!repo || !article || !ArticlePolicy.canEdit(admin, article)) notFound();

  const [revisions, published] = await Promise.all([repo.revisions(article.id), repo.publishedSummaries()]);

  return (
    // Keyed by version: after a publish, restore or review decision the
    // editor restarts from the saved state instead of a stale copy.
    <ArticleEditor
      key={`${article.id}:${article.version}`}
      article={article}
      viewer={{ id: admin.id, role: admin.role }}
      aiEnabled={ArticleReviewer.isConfigured()}
      revisions={revisions}
      publishedArticles={published.map((a) => ({ slug: a.slug, title: a.title }))}
    />
  );
}
