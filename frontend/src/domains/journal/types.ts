import type { ArticleFormat, Audience, Category, Difficulty, FrameworkRole } from "./services/JournalTaxonomy";

export type { ArticleFormat, Audience, Category, Difficulty, FrameworkRole };

/* ---------------------------------------------------------------------------
 * Content blocks. An article body is an ordered array of these, stored as one
 * JSON document (articles.draft / articles.published). `role` ties a block to
 * a section of the format's framework (see JournalFramework).
 * ------------------------------------------------------------------------- */

interface BlockBase {
  id: string;
  role?: FrameworkRole;
}

export interface HeadingBlock extends BlockBase {
  type: "heading";
  level: 2 | 3;
  text: string;
}

/** Inline syntax: **bold**, *italic*, `code`, [link](url), $tex$, [^sourceId]. Blank line = new paragraph; "- " / "1. " lines = lists. */
export interface TextBlock extends BlockBase {
  type: "text";
  text: string;
}

export interface TakeawayBlock extends BlockBase {
  type: "takeaway";
  points: string[];
}

export type CalloutTone = "note" | "key-insight" | "exam-trap" | "warning";

export interface CalloutBlock extends BlockBase {
  type: "callout";
  tone: CalloutTone;
  title: string;
  text: string;
}

/** "Floating text": a margin note beside the prose on wide screens, or a pull quote. */
export interface AsideBlock extends BlockBase {
  type: "aside";
  variant: "margin" | "pullquote";
  text: string;
}

export interface FormulaBlock extends BlockBase {
  type: "formula";
  tex: string;
  /** What each symbol means; shown under the formula. */
  explanation: string;
}

export interface ImageBlock extends BlockBase {
  type: "image";
  url: string;
  alt: string;
  caption: string;
  /** Set when the image is a static chart: provenance is then required. */
  chart: { source: string; asOf: string } | null;
}

export type ChartKind = "line" | "area" | "bar" | "scatter";
export type ChartFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "n/a";

export interface ChartBlock extends BlockBase {
  type: "chart";
  title: string;
  kind: ChartKind;
  /** CSV with a header row: first column is x, every other column is a series. */
  csv: string;
  xLabel: string;
  yLabel: string;
  unit: string;
  currency: string;
  source: string;
  sourceUrl: string;
  /** YYYY-MM-DD. */
  asOf: string;
  frequency: ChartFrequency;
  methodology: string;
  limitations: string;
  alt: string;
  caption: string;
}

export type CodeLanguage = "python" | "sql" | "r" | "bash" | "json" | "excel";

export interface CodeBlock extends BlockBase {
  type: "code";
  title: string;
  language: CodeLanguage;
  filename: string;
  code: string;
  /** What the code does and why; required to publish. */
  explanation: string;
  output: string;
  dependencies: string[];
  dataSource: string;
  limitations: string;
  downloadable: boolean;
}

export interface TableBlock extends BlockBase {
  type: "table";
  caption: string;
  /** CSV with a header row. */
  csv: string;
  source: string;
}

export interface FaqBlock extends BlockBase {
  type: "faq";
  items: { q: string; a: string }[];
}

export interface RelatedBlock extends BlockBase {
  type: "related";
  slugs: string[];
}

export type Block =
  | HeadingBlock
  | TextBlock
  | TakeawayBlock
  | CalloutBlock
  | AsideBlock
  | FormulaBlock
  | ImageBlock
  | ChartBlock
  | CodeBlock
  | TableBlock
  | FaqBlock
  | RelatedBlock;

export type BlockType = Block["type"];

export interface Source {
  /** Short handle cited inline as [^id]. */
  id: string;
  title: string;
  publisher: string;
  url: string;
  /** YYYY-MM-DD. */
  accessedAt: string;
  citation: string;
}

export interface CarouselSlide {
  title: string;
  points: string[];
}

export type SocialStatus = "not-started" | "drafted" | "posted";

export interface SocialDraft {
  hook: string;
  body: string;
  question: string;
  hashtags: string[];
  imageUrl: string;
  carousel: CarouselSlide[];
  status: SocialStatus;
}

export interface ArticleDocument {
  title: string;
  slug: string;
  subtitle: string;
  excerpt: string;
  format: ArticleFormat;
  category: Category | null;
  difficulty: Difficulty | null;
  audience: Audience[];
  tags: string[];
  featuredImage: { url: string; alt: string; caption: string } | null;
  seo: { title: string; description: string; canonical: string; ogTitle: string; ogDescription: string; ogImage: string };
  social: SocialDraft;
  cta: { label: string; href: string; text: string } | null;
  disclaimer: string;
  sources: Source[];
  blocks: Block[];
}

/* ---------------------------------------------------------------------------
 * Records.
 * ------------------------------------------------------------------------- */

/** Public state. A published article with a future date is "scheduled". */
export type ArticleStatus = "draft" | "published" | "archived";

/** Editors' work waits for an owner; owners' own articles skip review. */
export type ReviewState = "pending" | "changes-requested" | null;

export interface AiReviewFinding {
  severity: "issue" | "suggestion";
  where: string;
  comment: string;
}

export interface AiReview {
  at: string;
  model: string;
  summary: string;
  findings: AiReviewFinding[];
}

/** An article as the admin editor sees it. */
export interface ArticleRecord {
  id: string;
  status: ArticleStatus;
  authorId: string;
  authorName: string;
  draft: ArticleDocument;
  /** What readers see; null until first published. */
  published: ArticleDocument | null;
  reviewState: ReviewState;
  reviewNote: string | null;
  aiReview: AiReview | null;
  datePublished: string | null;
  dateModified: string | null;
  version: number;
  updatedAt: string;
}

/** Row of the admin list. */
export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  format: ArticleFormat;
  status: ArticleStatus;
  reviewState: ReviewState;
  authorName: string;
  datePublished: string | null;
  updatedAt: string;
  /** Draft differs from what's live. */
  hasUnpublishedChanges: boolean;
}

/** A live article, as served on /journal/[slug]. */
export interface PublishedArticle {
  id: string;
  doc: ArticleDocument;
  authorName: string;
  datePublished: string;
  dateModified: string;
}

/** Card on /journal and in related-article blocks. */
export interface ArticleSummary {
  slug: string;
  title: string;
  excerpt: string;
  format: ArticleFormat;
  category: Category | null;
  difficulty: Difficulty | null;
  audience: Audience[];
  tags: string[];
  datePublished: string;
  dateModified: string;
  featuredImage: { url: string; alt: string } | null;
}

export interface Revision {
  id: string;
  kind: "publish" | "checkpoint" | "restore" | "submit";
  createdAt: string;
  authorName: string;
  title: string;
}
