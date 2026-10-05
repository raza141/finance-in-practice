import type { ArticleDocument, Block } from "../types";
import { ChartData, CsvText } from "./ChartData";
import { InlineText } from "./InlineText";
import { ArticleContract } from "./ArticleContract";
import { ArticleExport } from "./ArticleExport";
import { JournalFramework } from "./JournalFramework";

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
  /** The block to jump to, when the issue belongs to one. */
  blockId?: string;
  /** The editor panel that holds the field: meta, seo, social or sources. */
  panel?: "meta" | "seo" | "sources";
}

export interface ValidationContext {
  /** Slugs of live articles, to check related-article blocks. */
  publishedSlugs?: ReadonlySet<string>;
  now?: Date;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: string) => DATE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
const isHttp = (v: string) => /^https?:\/\/\S+\.\S+/.test(v);

/**
 * The publishing checklist. Errors block publish and submit-for-review;
 * warnings are shown but don't. Runs live in the editor and again on the
 * server when publishing, so the two can never disagree.
 */
export class ArticleValidator {
  static check(doc: ArticleDocument, context: ValidationContext = {}): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const error = (message: string, where: Partial<ValidationIssue> = {}) => issues.push({ level: "error", message, ...where });
    const warn = (message: string, where: Partial<ValidationIssue> = {}) => issues.push({ level: "warning", message, ...where });

    // Metadata
    if (doc.title.trim().length < 10) error("Title: at least 10 characters.", { panel: "meta" });
    if (!ArticleContract.SLUG.test(doc.slug) || doc.slug.startsWith("draft-")) error("Slug: set a readable URL slug.", { panel: "meta" });
    if (!doc.category) error("Primary category is required.", { panel: "meta" });
    if (!doc.difficulty) warn("Difficulty is not set.", { panel: "meta" });
    if (doc.audience.length === 0) warn("No audience selected: readers can't filter to it.", { panel: "meta" });
    if (doc.excerpt.trim().length < 50) error("Excerpt: at least 50 characters (used on cards and as the summary).", { panel: "meta" });
    if (!doc.featuredImage?.url) error("Featured image is required.", { panel: "meta" });
    else if (doc.featuredImage.alt.trim().length < 5) error("Featured image needs alt text.", { panel: "meta" });
    if (JournalFramework.DISCLAIMER_REQUIRED.includes(doc.format) && doc.disclaimer.trim() === "") {
      error(`${doc.format}s need the non-investment-advice disclaimer.`, { panel: "meta" });
    }
    if (doc.cta && (!doc.cta.label.trim() || !InlineText.isSafeHref(doc.cta.href))) error("Call to action needs a label and a valid link.", { panel: "meta" });

    // SEO
    const description = doc.seo.description.trim();
    if (description.length < 50 || description.length > 160) error("Meta description: 50–160 characters.", { panel: "seo" });
    if ((doc.seo.title || doc.title).length > 65) warn("SEO title is over 65 characters and will be cut off in search results.", { panel: "seo" });
    if (doc.seo.canonical && !/^https:\/\/\S+$/.test(doc.seo.canonical)) error("Canonical URL must be an absolute https:// URL, or blank.", { panel: "seo" });

    // Sources
    if (doc.sources.length === 0) error("Add at least one source.", { panel: "sources" });
    const sourceIds = new Set<string>();
    for (const [i, s] of doc.sources.entries()) {
      const label = `Source ${i + 1}`;
      if (!s.id) error(`${label}: needs an id to cite it with.`, { panel: "sources" });
      else if (sourceIds.has(s.id)) error(`${label}: id "${s.id}" is used twice.`, { panel: "sources" });
      sourceIds.add(s.id);
      if (!s.title.trim()) error(`${label}: title is required.`, { panel: "sources" });
      if (!s.publisher.trim() && !s.url.trim()) error(`${label}: give a publisher or a URL.`, { panel: "sources" });
      if (s.url && !isHttp(s.url)) error(`${label}: URL must start with http(s)://.`, { panel: "sources" });
      if (s.accessedAt && !isDate(s.accessedAt)) error(`${label}: accessed date must be YYYY-MM-DD.`, { panel: "sources" });
    }
    const cited = new Set(ArticleExport.texts(doc).flatMap(InlineText.citations));
    for (const id of cited) if (!sourceIds.has(id)) error(`Citation [^${id}] has no matching source.`, { panel: "sources" });

    // Framework
    for (const section of JournalFramework.checklist(doc)) {
      if (section.required && section.state !== "done") {
        error(`Framework: "${section.label}" is ${section.state === "missing" ? "missing" : "empty"}.`, section.blockId ? { blockId: section.blockId } : {});
      }
    }

    // Blocks
    for (const block of doc.blocks) ArticleValidator.checkBlock(block, { error, warn }, context);

    // Links and length
    const links = ArticleExport.texts(doc).flatMap(InlineText.links);
    for (const href of links) if (!InlineText.isSafeHref(href)) error(`Link "${href}" is not http(s), site-relative or mailto; it will render as plain text.`);
    const internal = links.some((h) => h.startsWith("/") || h.includes("financeinpractice.me")) || doc.blocks.some((b) => b.type === "related" && b.slugs.length > 0);
    if (!internal) warn("No internal link: link to a course or another article.");
    if (ArticleExport.readingMinutes(doc) < 2) warn("Under 2 minutes of reading: is it finished?");

    return issues;
  }

  static errors(doc: ArticleDocument, context?: ValidationContext): ValidationIssue[] {
    return ArticleValidator.check(doc, context).filter((i) => i.level === "error");
  }

  private static checkBlock(
    block: Block,
    { error, warn }: { error: (m: string, w?: Partial<ValidationIssue>) => void; warn: (m: string, w?: Partial<ValidationIssue>) => void },
    context: ValidationContext,
  ): void {
    const at = { blockId: block.id };
    switch (block.type) {
      case "heading":
        if (!block.text.trim()) error("Empty heading.", at);
        break;
      case "image":
        if (!block.url) error("Image block has no image.", at);
        if (block.alt.trim().length < 5) error("Image needs alt text.", at);
        if (block.chart && (!block.chart.source.trim() || !isDate(block.chart.asOf))) error("Chart image needs its data source and as-of date.", at);
        break;
      case "chart": {
        const name = block.title || "Chart";
        if (!block.title.trim()) error("Chart needs a title.", at);
        const parsed = ChartData.parse(block.csv);
        if (!parsed.ok) error(`${name}: ${parsed.error}`, at);
        else if (block.kind === "scatter" && parsed.chart.series.length > ChartData.MAX_SCATTER_SERIES) {
          error(`${name}: scatter charts take at most ${ChartData.MAX_SCATTER_SERIES} series.`, at);
        } else if (block.kind === "scatter" && parsed.chart.scale !== "linear") error(`${name}: scatter needs numbers in the first column.`, at);
        if (!block.source.trim()) error(`${name}: data source is required.`, at);
        if (block.sourceUrl && !isHttp(block.sourceUrl)) error(`${name}: source URL must start with http(s)://.`, at);
        if (!isDate(block.asOf)) error(`${name}: as-of date (YYYY-MM-DD) is required.`, at);
        if (!block.unit.trim()) error(`${name}: unit is required (e.g. %, index points, PKR bn).`, at);
        if (!block.methodology.trim()) error(`${name}: methodology is required.`, at);
        if (!block.limitations.trim()) error(`${name}: limitations are required.`, at);
        if (block.alt.trim().length < 10) error(`${name}: describe the chart's takeaway in the alt text.`, at);
        if (isDate(block.asOf)) {
          const ageDays = ((context.now ?? new Date()).getTime() - new Date(`${block.asOf}T00:00:00Z`).getTime()) / 86_400_000;
          if (block.role === "chart" && ageDays > 30) warn(`${name}: data is ${Math.floor(ageDays)} days old.`, at);
        }
        break;
      }
      case "code":
        if (!block.code.trim()) error("Code block is empty.", at);
        if (block.explanation.trim().length < 20) error(`${block.title || "Code"}: explain what the code does (20+ characters).`, at);
        if (block.downloadable && block.filename && !/\.[A-Za-z0-9]+$/.test(block.filename)) warn("Download filename has no extension.", at);
        break;
      case "formula":
        if (!block.tex.trim()) error("Formula is empty.", at);
        else if (!block.explanation.trim()) warn("Formula: explain the symbols.", at);
        break;
      case "table": {
        const rows = CsvText.parse(block.csv);
        if (rows.length < 2) error("Table needs a header row and at least one data row.", at);
        if (!block.caption.trim()) error("Table needs a caption.", at);
        break;
      }
      case "faq":
        if (block.items.some((i) => !i.q.trim() !== !i.a.trim())) error("FAQ: every question needs an answer.", at);
        if (!block.items.some((i) => i.q.trim())) error("FAQ block is empty.", at);
        break;
      case "related":
        if (context.publishedSlugs) {
          for (const slug of block.slugs) if (!context.publishedSlugs.has(slug)) error(`Related article "${slug}" is not published.`, at);
        }
        break;
      case "takeaway":
        if (block.points.filter((p) => p.trim()).length > 4) warn("Keep the takeaway to four points or fewer.", at);
        break;
      case "callout":
      case "aside":
      case "text":
        break;
    }
  }
}
