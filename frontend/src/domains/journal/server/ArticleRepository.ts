import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import { ArticleContract } from "../services/ArticleContract";
import type {
  AiReview,
  ArticleDocument,
  ArticleFormat,
  ArticleListItem,
  ArticleRecord,
  ArticleStatus,
  ArticleSummary,
  Audience,
  Category,
  PublishedArticle,
  ReviewState,
  Revision,
} from "../types";

interface ArticleRow {
  id: string;
  slug: string;
  status: ArticleStatus;
  review_state: ReviewState;
  author_id: string;
  author_name: string;
  draft: unknown;
  published: unknown;
  review_note: string | null;
  ai_review: AiReview | null;
  date_published: Date | string | null;
  date_modified: Date | string | null;
  version: number;
  updated_at: Date | string;
}

export type AutosaveResult =
  | { status: "saved"; version: number; slug: string; slugTaken: boolean }
  | { status: "conflict" }
  | { status: "missing" };

export interface PublicFilters {
  category?: Category | null;
  format?: ArticleFormat | null;
  audience?: Audience | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (v: Date | string | null): string | null => (v === null ? null : new Date(v).toISOString());
const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";

/** Research articles and their revisions. Schema: scripts/db/migrate.mts (009_articles). */
export class ArticleRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): ArticleRepository | null {
    const sql = Database.sql();
    return sql ? new ArticleRepository(sql) : null;
  }

  /* ----------------------------- admin ----------------------------- */

  /** Every article, newest edit first; editors see only their own. */
  async list(authorId: string | null): Promise<ArticleListItem[]> {
    const rows = (await this.sql`
      SELECT a.id, a.slug, a.status, a.review_state, a.date_published, a.updated_at, u.name AS author_name,
             a.draft->>'title' AS title, a.draft->>'format' AS format,
             (a.published IS NOT NULL AND a.published <> a.draft) AS changed
      FROM articles a JOIN admin_users u ON u.id = a.author_id
      WHERE ${authorId}::uuid IS NULL OR a.author_id = ${authorId}
      ORDER BY a.updated_at DESC
    `) as (Pick<ArticleRow, "id" | "slug" | "status" | "review_state" | "date_published" | "updated_at" | "author_name"> & {
      title: string | null;
      format: ArticleFormat;
      changed: boolean;
    })[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title || "Untitled draft",
      slug: r.slug,
      format: r.format,
      status: r.status,
      reviewState: r.review_state,
      authorName: r.author_name,
      datePublished: iso(r.date_published),
      updatedAt: iso(r.updated_at)!,
      hasUnpublishedChanges: r.changed,
    }));
  }

  async counts(): Promise<Record<ArticleStatus, number>> {
    const rows = (await this.sql`SELECT status, count(*)::int AS n FROM articles GROUP BY status`) as { status: ArticleStatus; n: number }[];
    const counts = { draft: 0, published: 0, archived: 0 };
    for (const r of rows) counts[r.status] = r.n;
    return counts;
  }

  async byId(id: string): Promise<ArticleRecord | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`
      SELECT a.*, u.name AS author_name
      FROM articles a JOIN admin_users u ON u.id = a.author_id
      WHERE a.id = ${id}
    `) as ArticleRow[];
    return row ? ArticleRepository.toRecord(row) : null;
  }

  async create(authorId: string, doc: ArticleDocument): Promise<string> {
    const [row] = (await this.sql`
      INSERT INTO articles (slug, author_id, format, draft)
      VALUES (${doc.slug}, ${authorId}, ${doc.format}, ${JSON.stringify(doc)}::jsonb)
      RETURNING id
    `) as { id: string }[];
    return row.id;
  }

  /**
   * Save the working draft if nobody else saved since `version`. Until the
   * first publish the slug and filter columns follow the draft; after that
   * they only change on publish, so the live URL never moves.
   */
  async autosave(id: string, version: number, doc: ArticleDocument): Promise<AutosaveResult> {
    if (!UUID.test(id)) return { status: "missing" };
    const slug = ArticleContract.SLUG.test(doc.slug) ? doc.slug : null;
    const attempt = async (withSlug: boolean) =>
      (await this.sql`
        UPDATE articles SET
          draft = ${JSON.stringify(doc)}::jsonb,
          version = version + 1,
          updated_at = now(),
          slug = CASE WHEN published IS NULL AND ${withSlug ? slug : null}::text IS NOT NULL THEN ${withSlug ? slug : null} ELSE slug END,
          format = CASE WHEN published IS NULL THEN ${doc.format} ELSE format END,
          category = CASE WHEN published IS NULL THEN ${doc.category} ELSE category END,
          difficulty = CASE WHEN published IS NULL THEN ${doc.difficulty} ELSE difficulty END,
          audience = CASE WHEN published IS NULL THEN ${doc.audience}::text[] ELSE audience END,
          tags = CASE WHEN published IS NULL THEN ${doc.tags}::text[] ELSE tags END
        WHERE id = ${id} AND version = ${version}
        RETURNING version, slug
      `) as { version: number; slug: string }[];

    let rows: { version: number; slug: string }[];
    let slugTaken = false;
    try {
      rows = await attempt(true);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Keep the draft; only the slug change is refused.
      slugTaken = true;
      rows = await attempt(false);
    }
    if (rows.length === 0) {
      const [exists] = (await this.sql`SELECT 1 FROM articles WHERE id = ${id}`) as unknown[];
      return exists ? { status: "conflict" } : { status: "missing" };
    }
    return { status: "saved", version: rows[0].version, slug: rows[0].slug, slugTaken };
  }

  /**
   * Make the current draft live (or scheduled, when `at` is in the future).
   * The first publish date sticks once the article has gone live.
   * Returns the live slug, or null if the draft changed since `version`.
   */
  async publish(id: string, version: number, userId: string, at: Date | null): Promise<string | null> {
    const when = (at ?? new Date()).toISOString();
    const [rows] = await this.sql.transaction([
      this.sql`
        UPDATE articles SET
          status = 'published',
          review_state = NULL,
          published = jsonb_set(draft, '{slug}', to_jsonb(slug)),
          draft = jsonb_set(draft, '{slug}', to_jsonb(slug)),
          review_note = NULL,
          format = draft->>'format',
          category = draft->>'category',
          difficulty = draft->>'difficulty',
          audience = ARRAY(SELECT jsonb_array_elements_text(draft->'audience')),
          tags = ARRAY(SELECT jsonb_array_elements_text(draft->'tags')),
          -- Once an article has gone live its first publish date sticks; until then (or while scheduled) it can move.
          date_published = CASE WHEN published IS NOT NULL AND date_published <= now() THEN date_published
                                ELSE ${when}::timestamptz END,
          date_modified = GREATEST(now(), ${when}::timestamptz),
          version = version + 1,
          updated_at = now()
        WHERE id = ${id} AND version = ${version}
        RETURNING slug
      `,
      this.sql`
        INSERT INTO article_revisions (article_id, kind, document, created_by)
        SELECT id, 'publish', published, ${userId} FROM articles WHERE id = ${id} AND version = ${version + 1}
      `,
    ]);
    return (rows as { slug: string }[])[0]?.slug ?? null;
  }

  /** Editor hands the draft to an owner. Returns false if the draft changed since `version`. */
  async submit(id: string, version: number, userId: string): Promise<boolean> {
    const [rows] = await this.sql.transaction([
      this.sql`
        UPDATE articles SET review_state = 'pending', review_note = NULL, version = version + 1, updated_at = now()
        WHERE id = ${id} AND version = ${version} AND status <> 'archived'
        RETURNING id
      `,
      this.sql`
        INSERT INTO article_revisions (article_id, kind, document, created_by)
        SELECT id, 'submit', draft, ${userId} FROM articles WHERE id = ${id} AND version = ${version + 1}
      `,
    ]);
    return (rows as unknown[]).length > 0;
  }

  /** Owner sends a submission back with a note. A live article stays live. */
  async requestChanges(id: string, note: string): Promise<boolean> {
    const rows = (await this.sql`
      UPDATE articles SET review_state = 'changes-requested', review_note = ${note}, version = version + 1, updated_at = now()
      WHERE id = ${id} AND review_state = 'pending'
      RETURNING id
    `) as unknown[];
    return rows.length > 0;
  }

  async pendingReviews(): Promise<number> {
    const [row] = (await this.sql`SELECT count(*)::int AS n FROM articles WHERE review_state = 'pending'`) as { n: number }[];
    return row.n;
  }

  /** Take a live or scheduled article down; the draft stays. Returns its slug. */
  async unpublish(id: string): Promise<string | null> {
    const [row] = (await this.sql`
      UPDATE articles SET status = 'draft', version = version + 1, updated_at = now()
      WHERE id = ${id} AND status = 'published' RETURNING slug
    `) as { slug: string }[];
    return row?.slug ?? null;
  }

  async setArchived(id: string, archived: boolean): Promise<string | null> {
    const [row] = (await this.sql`
      UPDATE articles SET status = ${archived ? "archived" : "draft"}, version = version + 1, updated_at = now()
      WHERE id = ${id} RETURNING slug
    `) as { slug: string }[];
    return row?.slug ?? null;
  }

  async remove(id: string): Promise<string | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`DELETE FROM articles WHERE id = ${id} RETURNING slug`) as { slug: string }[];
    return row?.slug ?? null;
  }

  async duplicate(id: string, authorId: string): Promise<string | null> {
    const source = await this.byId(id);
    if (!source) return null;
    const suffix = crypto.randomUUID().slice(0, 6);
    const doc: ArticleDocument = {
      ...source.draft,
      title: `Copy of ${source.draft.title}`.slice(0, 160),
      slug: `${source.draft.slug}-copy-${suffix}`.slice(0, 100),
      social: { ...source.draft.social, status: "not-started" },
    };
    try {
      return await this.create(authorId, doc);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.create(authorId, { ...doc, slug: `draft-${suffix}` });
    }
  }

  async checkpoint(id: string, userId: string): Promise<void> {
    await this.sql`
      INSERT INTO article_revisions (article_id, kind, document, created_by)
      SELECT id, 'checkpoint', draft, ${userId} FROM articles WHERE id = ${id}
    `;
  }

  async revisions(id: string): Promise<Revision[]> {
    if (!UUID.test(id)) return [];
    const rows = (await this.sql`
      SELECT r.id, r.kind, r.created_at, COALESCE(u.name, 'Former admin') AS author_name, r.document->>'title' AS title
      FROM article_revisions r LEFT JOIN admin_users u ON u.id = r.created_by
      WHERE r.article_id = ${id}
      ORDER BY r.created_at DESC
      LIMIT 100
    `) as { id: string; kind: Revision["kind"]; created_at: Date | string; author_name: string; title: string | null }[];
    return rows.map((r) => ({ id: r.id, kind: r.kind, createdAt: iso(r.created_at)!, authorName: r.author_name, title: r.title ?? "" }));
  }

  /** Replace the draft with a revision's document; the slug of a published article is kept. */
  async restore(id: string, revisionId: string, userId: string): Promise<boolean> {
    if (!UUID.test(revisionId)) return false;
    const [rows] = await this.sql.transaction([
      this.sql`
        UPDATE articles a SET
          draft = jsonb_set(r.document, '{slug}', to_jsonb(CASE WHEN a.published IS NULL THEN COALESCE(r.document->>'slug', a.slug) ELSE a.slug END)),
          version = a.version + 1, updated_at = now()
        FROM article_revisions r
        WHERE a.id = ${id} AND r.id = ${revisionId} AND r.article_id = a.id
        RETURNING a.id
      `,
      this.sql`
        INSERT INTO article_revisions (article_id, kind, document, created_by)
        SELECT a.id, 'restore', a.draft, ${userId} FROM articles a
        WHERE a.id = ${id} AND EXISTS (SELECT 1 FROM article_revisions r WHERE r.id = ${revisionId} AND r.article_id = a.id)
      `,
    ]);
    return (rows as unknown[]).length > 0;
  }

  async setAiReview(id: string, review: AiReview): Promise<void> {
    await this.sql`UPDATE articles SET ai_review = ${JSON.stringify(review)}::jsonb WHERE id = ${id}`;
  }

  /* ----------------------------- public ----------------------------- */

  /** A live article (published, and its date has arrived), or null. */
  async publishedBySlug(slug: string): Promise<PublishedArticle | null> {
    if (!ArticleContract.SLUG.test(slug) || slug.length > 100) return null;
    const [row] = (await this.sql`
      SELECT a.id, a.published, a.date_published, a.date_modified, u.name AS author_name
      FROM articles a JOIN admin_users u ON u.id = a.author_id
      WHERE a.slug = ${slug} AND a.status = 'published' AND a.date_published <= now()
    `) as Pick<ArticleRow, "id" | "published" | "date_published" | "date_modified" | "author_name">[];
    if (!row) return null;
    return {
      id: row.id,
      doc: ArticleContract.normalize(row.published),
      authorName: row.author_name,
      datePublished: iso(row.date_published)!,
      dateModified: iso(row.date_modified)!,
    };
  }

  /** Live articles, newest first, optionally filtered. */
  async publishedSummaries(filters: PublicFilters = {}): Promise<ArticleSummary[]> {
    const { category = null, format = null, audience = null } = filters;
    const rows = (await this.sql`
      SELECT published, date_published, date_modified
      FROM articles
      WHERE status = 'published' AND date_published <= now()
        AND (${category}::text IS NULL OR category = ${category})
        AND (${format}::text IS NULL OR format = ${format})
        AND (${audience}::text IS NULL OR ${audience} = ANY (audience))
      ORDER BY date_published DESC
    `) as Pick<ArticleRow, "published" | "date_published" | "date_modified">[];
    return rows.map((r) => ArticleRepository.toSummary(r));
  }

  /** Live articles with these slugs, in the given order. */
  async summariesBySlugs(slugs: readonly string[]): Promise<ArticleSummary[]> {
    if (slugs.length === 0) return [];
    const rows = (await this.sql`
      SELECT published, date_published, date_modified FROM articles
      WHERE status = 'published' AND date_published <= now() AND slug = ANY (${[...slugs]}::text[])
    `) as Pick<ArticleRow, "published" | "date_published" | "date_modified">[];
    const bySlug = new Map(rows.map((r) => [ArticleRepository.toSummary(r).slug, ArticleRepository.toSummary(r)]));
    return slugs.map((s) => bySlug.get(s)).filter((s): s is ArticleSummary => s !== undefined);
  }

  /** Slugs of live articles, for related-article validation. */
  async publishedSlugs(): Promise<Set<string>> {
    const rows = (await this.sql`
      SELECT slug FROM articles WHERE status = 'published' AND date_published <= now()
    `) as { slug: string }[];
    return new Set(rows.map((r) => r.slug));
  }

  private static toSummary(row: Pick<ArticleRow, "published" | "date_published" | "date_modified">): ArticleSummary {
    const doc = ArticleContract.normalize(row.published);
    return {
      slug: doc.slug,
      title: doc.title,
      excerpt: doc.excerpt,
      format: doc.format,
      category: doc.category,
      difficulty: doc.difficulty,
      audience: doc.audience,
      tags: doc.tags,
      datePublished: iso(row.date_published)!,
      dateModified: iso(row.date_modified)!,
      featuredImage: doc.featuredImage ? { url: doc.featuredImage.url, alt: doc.featuredImage.alt } : null,
    };
  }

  private static toRecord(row: ArticleRow): ArticleRecord {
    const draft = ArticleContract.normalize(row.draft);
    return {
      id: row.id,
      status: row.status,
      authorId: row.author_id,
      authorName: row.author_name,
      // The slug column is authoritative once published.
      draft: { ...draft, slug: row.published ? row.slug : draft.slug || row.slug },
      published: row.published ? ArticleContract.normalize(row.published) : null,
      reviewState: row.review_state,
      reviewNote: row.review_note,
      aiReview: row.ai_review,
      datePublished: iso(row.date_published),
      dateModified: iso(row.date_modified),
      version: row.version,
      updatedAt: iso(row.updated_at)!,
    };
  }
}
