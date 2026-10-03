export interface ArticleSection {
  heading?: string;
  paragraphs: string[];
}

/** A Journal entry, as served on /journal/[slug]. */
export interface Article {
  slug: string;
  title: string;
  summary: string;
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string;
  tags: string[];
  sections: ArticleSection[];
}
