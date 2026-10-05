import type {
  ArticleDocument,
  Block,
  CalloutTone,
  CarouselSlide,
  ChartFrequency,
  ChartKind,
  CodeLanguage,
  SocialStatus,
  Source,
} from "../types";
import { JournalFramework } from "./JournalFramework";
import { JournalTaxonomy } from "./JournalTaxonomy";

type Json = Record<string, unknown>;

const obj = (v: unknown): Json => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T =>
  (values as readonly unknown[]).includes(v) ? (v as T) : fallback;

/**
 * Shape check for an article document arriving from the editor (autosave,
 * publish). Lenient by design: a half-written draft always saves, so this only
 * coerces types, drops what it doesn't recognise and caps sizes. Whether the
 * article is ready to publish is ArticleValidator's job.
 */
export class ArticleContract {
  static readonly MAX_BYTES = 1_000_000;
  static readonly MAX_BLOCKS = 300;
  static readonly SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  static readonly IMAGE_URL = /^(https:\/\/\S+|\/[A-Za-z0-9/._-]+)$/;

  static readonly CALLOUT_TONES: readonly CalloutTone[] = ["note", "key-insight", "exam-trap", "warning"];
  static readonly CHART_KINDS: readonly ChartKind[] = ["line", "area", "bar", "scatter"];
  static readonly FREQUENCIES: readonly ChartFrequency[] = ["daily", "weekly", "monthly", "quarterly", "annual", "n/a"];
  static readonly LANGUAGES: readonly CodeLanguage[] = ["python", "sql", "r", "bash", "json", "excel"];
  static readonly SOCIAL_STATUSES: readonly SocialStatus[] = ["not-started", "drafted", "posted"];

  /** "Three Ways to Compute VaR" -> "three-ways-to-compute-var". */
  static slugify(title: string): string {
    return title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100)
      .replace(/-+$/, "");
  }

  /** JSON text from the editor -> a document, or why it was refused. */
  static parseJson(raw: string): { ok: true; doc: ArticleDocument } | { ok: false; error: string } {
    if (raw.length > ArticleContract.MAX_BYTES) return { ok: false, error: "The article is larger than 1 MB. Split it, or move data out of charts." };
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, error: "The article could not be read." };
    }
    return { ok: true, doc: ArticleContract.normalize(value) };
  }

  static normalize(value: unknown): ArticleDocument {
    const v = obj(value);
    const format = oneOf(v.format, JournalTaxonomy.FORMATS, "Explainer");
    const seo = obj(v.seo);
    const social = obj(v.social);
    const image = obj(v.featuredImage);
    const cta = obj(v.cta);
    const slug = str(v.slug, 100).toLowerCase();

    return {
      title: str(v.title, 160),
      slug,
      subtitle: str(v.subtitle, 240),
      excerpt: str(v.excerpt, 400),
      format,
      category: JournalTaxonomy.isCategory(v.category) ? v.category : null,
      difficulty: JournalTaxonomy.isDifficulty(v.difficulty) ? v.difficulty : null,
      audience: [...new Set(list(v.audience).filter(JournalTaxonomy.isAudience))],
      tags: ArticleContract.tags(v.tags),
      featuredImage: image.url ? { url: ArticleContract.imageUrl(image.url), alt: str(image.alt, 300), caption: str(image.caption, 400) } : null,
      seo: {
        title: str(seo.title, 120),
        description: str(seo.description, 320),
        canonical: str(seo.canonical, 500),
        ogTitle: str(seo.ogTitle, 120),
        ogDescription: str(seo.ogDescription, 320),
        ogImage: ArticleContract.imageUrl(seo.ogImage),
      },
      social: {
        hook: str(social.hook, 300),
        body: str(social.body, 3000),
        question: str(social.question, 300),
        hashtags: list(social.hashtags).map((h) => str(h, 40).replace(/^#/, "").replace(/\s+/g, "")).filter(Boolean).slice(0, 10),
        imageUrl: ArticleContract.imageUrl(social.imageUrl),
        carousel: list(social.carousel)
          .slice(0, 12)
          .map((s): CarouselSlide => ({ title: str(obj(s).title, 120), points: list(obj(s).points).map((p) => str(p, 200)).slice(0, 6) })),
        status: oneOf(social.status, ArticleContract.SOCIAL_STATUSES, "not-started"),
      },
      cta: cta.label || cta.href ? { label: str(cta.label, 60), href: str(cta.href, 300), text: str(cta.text, 300) } : null,
      disclaimer: typeof v.disclaimer === "string" ? v.disclaimer.slice(0, 1000) : JournalFramework.DEFAULT_DISCLAIMER,
      sources: list(v.sources).slice(0, 100).map(ArticleContract.source),
      blocks: list(v.blocks)
        .slice(0, ArticleContract.MAX_BLOCKS)
        .map(ArticleContract.block)
        .filter((b): b is Block => b !== null),
    };
  }

  private static tags(value: unknown): string[] {
    const tags = list(value)
      .map((t) => str(t, 40).trim())
      .filter(Boolean);
    return [...new Set(tags)].slice(0, 12);
  }

  /** Only https:// or site-relative images; anything else is dropped. */
  private static imageUrl(value: unknown): string {
    const url = str(value, 500).trim();
    return ArticleContract.IMAGE_URL.test(url) ? url : "";
  }

  private static source(value: unknown): Source {
    const s = obj(value);
    return {
      id: str(s.id, 40).replace(/[^A-Za-z0-9_-]/g, ""),
      title: str(s.title, 300),
      publisher: str(s.publisher, 160),
      url: str(s.url, 500),
      accessedAt: str(s.accessedAt, 10),
      citation: str(s.citation, 600),
    };
  }

  private static block(value: unknown): Block | null {
    const b = obj(value);
    const id = str(b.id, 40).replace(/[^A-Za-z0-9_-]/g, "") || crypto.randomUUID().slice(0, 8);
    const base = { id, ...(JournalTaxonomy.isRole(b.role) && { role: b.role }) };
    switch (b.type) {
      case "heading":
        return { ...base, type: "heading", level: b.level === 3 ? 3 : 2, text: str(b.text, 200) };
      case "text":
        return { ...base, type: "text", text: str(b.text, 20_000) };
      case "takeaway":
        return { ...base, type: "takeaway", points: list(b.points).map((p) => str(p, 400)).slice(0, 6) };
      case "callout":
        return { ...base, type: "callout", tone: oneOf(b.tone, ArticleContract.CALLOUT_TONES, "note"), title: str(b.title, 120), text: str(b.text, 4000) };
      case "aside":
        return { ...base, type: "aside", variant: b.variant === "pullquote" ? "pullquote" : "margin", text: str(b.text, 1000) };
      case "formula":
        return { ...base, type: "formula", tex: str(b.tex, 2000), explanation: str(b.explanation, 2000) };
      case "image": {
        const chart = obj(b.chart);
        return {
          ...base,
          type: "image",
          url: ArticleContract.imageUrl(b.url),
          alt: str(b.alt, 300),
          caption: str(b.caption, 400),
          chart: b.chart ? { source: str(chart.source, 200), asOf: str(chart.asOf, 10) } : null,
        };
      }
      case "chart":
        return {
          ...base,
          type: "chart",
          title: str(b.title, 160),
          kind: oneOf(b.kind, ArticleContract.CHART_KINDS, "line"),
          csv: str(b.csv, 200_000),
          xLabel: str(b.xLabel, 60),
          yLabel: str(b.yLabel, 60),
          unit: str(b.unit, 30),
          currency: str(b.currency, 3).toUpperCase(),
          source: str(b.source, 200),
          sourceUrl: str(b.sourceUrl, 500),
          asOf: str(b.asOf, 10),
          frequency: oneOf(b.frequency, ArticleContract.FREQUENCIES, "n/a"),
          methodology: str(b.methodology, 2000),
          limitations: str(b.limitations, 2000),
          alt: str(b.alt, 400),
          caption: str(b.caption, 400),
        };
      case "code":
        return {
          ...base,
          type: "code",
          title: str(b.title, 160),
          language: oneOf(b.language, ArticleContract.LANGUAGES, "python"),
          filename: str(b.filename, 80).replace(/[^A-Za-z0-9._-]/g, ""),
          code: str(b.code, 50_000),
          explanation: str(b.explanation, 4000),
          output: str(b.output, 20_000),
          dependencies: list(b.dependencies).map((d) => str(d, 60).trim()).filter(Boolean).slice(0, 20),
          dataSource: str(b.dataSource, 300),
          limitations: str(b.limitations, 1000),
          downloadable: b.downloadable !== false,
        };
      case "table":
        return { ...base, type: "table", caption: str(b.caption, 300), csv: str(b.csv, 50_000), source: str(b.source, 300) };
      case "faq":
        return {
          ...base,
          type: "faq",
          items: list(b.items)
            .slice(0, 20)
            .map((i) => ({ q: str(obj(i).q, 300), a: str(obj(i).a, 3000) })),
        };
      case "related":
        return {
          ...base,
          type: "related",
          slugs: list(b.slugs)
            .map((s) => str(s, 100).trim().toLowerCase())
            .filter((s) => ArticleContract.SLUG.test(s))
            .slice(0, 6),
        };
      default:
        return null;
    }
  }
}
