import "katex/dist/katex.min.css";

import Link from "next/link";

import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { siteConfig } from "@/core/config/site";

import { CodeHighlighter } from "../server/CodeHighlighter";
import { ArticleExport } from "../services/ArticleExport";
import { CsvText } from "../services/ChartData";
import { JournalDates } from "../services/JournalDates";
import type { ArticleDocument, ArticleSummary, Block, CalloutBlock } from "../types";
import { ChartView } from "./ChartView";
import { CodeBlockView } from "./CodeBlockView";
import { DownloadButton } from "./DownloadButton";
import { Inline, RichText, texToHtml, type CitationIndex } from "./RichText";

const CALLOUT_STYLE: Record<CalloutBlock["tone"], { label: string; className: string }> = {
  note: { label: "Note", className: "border-line bg-surface/70" },
  "key-insight": { label: "Key insight", className: "border-quant/40 bg-quant/5" },
  "exam-trap": { label: "Exam trap", className: "border-gold/50 bg-gold/5" },
  warning: { label: "Caution", className: "border-red-400/40 bg-red-400/5" },
};

export interface ArticleViewProps {
  doc: ArticleDocument;
  authorName: string;
  /** ISO; null in a preview of a never-published draft. */
  datePublished: string | null;
  dateModified: string | null;
  related: ArticleSummary[];
  /** Absolute URL of the live page, for downloads that cite it. */
  url: string;
}

/** A research article, as readers see it. The admin preview renders the same component. */
export async function ArticleView({ doc, authorName, datePublished, dateModified, related, url }: ArticleViewProps) {
  const cites: CitationIndex = new Map(doc.sources.map((s, i) => [s.id, i + 1]));
  const minutes = ArticleExport.readingMinutes(doc);
  const codeHtml = new Map(
    await Promise.all(
      doc.blocks.filter((b) => b.type === "code").map(async (b) => [b.id, await CodeHighlighter.html(b.code, b.language)] as const),
    ),
  );
  const cta = doc.cta ?? { label: siteConfig.navCta.label, href: siteConfig.navCta.href, text: "Free 30-minute call to check fit, schedule and prerequisites." };
  const updated = datePublished && dateModified && JournalDates.day(dateModified) !== JournalDates.day(datePublished);
  let codeIndex = 0;

  function render(block: Block) {
    switch (block.type) {
      case "heading": {
        const Tag = block.level === 2 ? "h2" : "h3";
        return (
          <Tag key={block.id} id={block.id} className={block.level === 2 ? "mt-12 scroll-mt-28 text-2xl font-bold sm:text-3xl" : "mt-8 scroll-mt-28 text-lg font-semibold"}>
            {block.text}
          </Tag>
        );
      }
      case "text":
        return <RichText key={block.id} text={block.text} cites={cites} className="mt-5 text-[1.05rem] text-ink/90" />;
      case "takeaway":
        return (
          <aside key={block.id} aria-label="Executive takeaway" className="mt-8 rounded-xl border border-quant/40 bg-quant/5 p-6">
            <p className="font-mono text-[11px] tracking-[0.22em] text-quant uppercase">Executive takeaway</p>
            <ul className="mt-3 space-y-2">
              {block.points.filter(Boolean).map((p, i) => (
                <li key={i} className="flex gap-3 leading-relaxed text-ink">
                  <span aria-hidden className="text-quant">→</span>
                  <span>
                    <Inline text={p} cites={cites} />
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        );
      case "callout": {
        const style = CALLOUT_STYLE[block.tone];
        return (
          <aside key={block.id} className={`mt-8 rounded-xl border p-5 ${style.className}`}>
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">{style.label}</p>
            {block.title && <p className="mt-1 font-semibold text-ink">{block.title}</p>}
            <RichText text={block.text} cites={cites} className="mt-2 text-ink/90" />
          </aside>
        );
      }
      case "aside":
        return block.variant === "pullquote" ? (
          <blockquote key={block.id} className="my-10 border-l-2 border-gold pl-6 font-serif text-2xl leading-snug text-ink italic">
            <Inline text={block.text} cites={cites} />
          </blockquote>
        ) : (
          <aside
            key={block.id}
            aria-label="Margin note"
            className="mt-5 rounded-lg border border-line bg-surface/60 p-4 text-sm leading-relaxed text-muted 2xl:float-right 2xl:clear-right 2xl:-mr-[18rem] 2xl:mt-1 2xl:w-60 2xl:border-0 2xl:border-l 2xl:bg-transparent 2xl:p-0 2xl:pl-4"
          >
            <Inline text={block.text} cites={cites} />
          </aside>
        );
      case "formula":
        return (
          <figure key={block.id} className="my-8 rounded-xl border border-line bg-surface/50 px-5 py-4">
            <div className="overflow-x-auto py-2 text-lg" dangerouslySetInnerHTML={{ __html: texToHtml(block.tex, true) }} />
            {block.explanation && (
              <figcaption>
                <RichText text={block.explanation} cites={cites} className="mt-2 border-t border-line pt-3 text-sm text-muted" />
              </figcaption>
            )}
          </figure>
        );
      case "image":
        return (
          <figure key={block.id} className="my-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- author images from Blob, dimensions unknown */}
            <img src={block.url} alt={block.alt} loading="lazy" className="w-full rounded-lg border border-line" />
            {(block.caption || block.chart) && (
              <figcaption className="mt-2 text-xs text-muted">
                {block.caption}
                {block.chart && (
                  <span className="block font-mono">
                    Source: {block.chart.source} · Data as of <time dateTime={block.chart.asOf}>{block.chart.asOf}</time>
                  </span>
                )}
              </figcaption>
            )}
          </figure>
        );
      case "chart":
        return <ChartView key={block.id} block={block} />;
      case "code": {
        const filename = ArticleExport.filename(block, codeIndex++);
        return (
          <CodeBlockView
            key={block.id}
            html={codeHtml.get(block.id) ?? ""}
            code={block.code}
            language={block.language}
            title={block.title}
            filename={filename}
            downloadable={block.downloadable}
            output={block.output}
            dependencies={block.dependencies}
          >
            {block.explanation && <RichText text={block.explanation} cites={cites} className="mb-3 text-ink/90" />}
            {(block.dataSource || block.limitations) && (
              <p className="mb-3 text-xs text-muted">
                {block.dataSource && <>Data: {block.dataSource}. </>}
                {block.limitations && <>Limitations: {block.limitations}</>}
              </p>
            )}
          </CodeBlockView>
        );
      }
      case "table": {
        const [header = [], ...rows] = CsvText.parse(block.csv);
        return (
          <figure key={block.id} className="my-8">
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <caption className="border-b border-line bg-surface px-4 py-2 text-left font-mono text-xs text-muted">{block.caption}</caption>
                <thead>
                  <tr className="border-b border-line">
                    {header.map((h, i) => (
                      <th key={i} scope="col" className="px-4 py-2 font-mono text-xs font-semibold text-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-data divide-y divide-line">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {r.map((c, j) => (
                        <td key={j} className="px-4 py-2 text-ink/90">
                          <Inline text={c} cites={cites} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {block.source && <figcaption className="mt-2 font-mono text-xs text-muted">Source: {block.source}</figcaption>}
          </figure>
        );
      }
      case "faq":
        return (
          <section key={block.id} aria-label="Frequently asked questions" className="mt-10">
            <h2 className="text-2xl font-bold">Frequently asked questions</h2>
            <div className="mt-4 divide-y divide-line border-y border-line">
              {block.items
                .filter((i) => i.q && i.a)
                .map((item, i) => (
                  <details key={i} className="group py-4">
                    <summary className="cursor-pointer font-semibold text-ink marker:text-quant">{item.q}</summary>
                    <RichText text={item.a} cites={cites} className="mt-3 text-ink/85" />
                  </details>
                ))}
            </div>
          </section>
        );
      case "related": {
        const cards = related.filter((r) => block.slugs.includes(r.slug));
        if (cards.length === 0) return null;
        return (
          <nav key={block.id} aria-label="Related articles" className="mt-10">
            <p className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Related</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {cards.map((r) => (
                <li key={r.slug}>
                  <Link href={`/journal/${r.slug}`} className="block h-full rounded-xl border border-line bg-surface p-4 transition-colors hover:border-quant/50">
                    <span className="font-mono text-[11px] text-quant">{r.format}</span>
                    <span className="mt-1 block font-semibold text-ink">{r.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        );
      }
    }
  }

  return (
    <article className="page-container max-w-3xl pt-14 pb-20 lg:pt-20">
      <Link href="/journal" className="font-mono text-xs tracking-[0.16em] text-quant uppercase hover:text-ink">
        ← Research Terminal
      </Link>
      <p className="mt-6 font-mono text-xs tracking-[0.16em] text-muted uppercase">
        {[doc.category, doc.format, doc.difficulty].filter(Boolean).join(" · ")}
      </p>
      <h1 className="mt-3 text-4xl leading-tight font-black sm:text-5xl">{doc.title || "Untitled draft"}</h1>
      {doc.subtitle && <p className="mt-4 text-xl leading-relaxed text-muted">{doc.subtitle}</p>}
      <p className="mt-5 font-mono text-xs text-muted">
        {authorName}
        {datePublished && (
          <>
            {" · "}
            <time dateTime={datePublished}>{JournalDates.long(datePublished)}</time>
          </>
        )}
        {updated && (
          <>
            {" · Updated "}
            <time dateTime={dateModified!}>{JournalDates.long(dateModified!)}</time>
          </>
        )}
        {` · ${minutes} min read`}
        {doc.audience.length > 0 && ` · For ${doc.audience.join(", ")}`}
      </p>

      {doc.featuredImage?.url && (
        <figure className="mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- author images from Blob, dimensions unknown */}
          <img src={doc.featuredImage.url} alt={doc.featuredImage.alt} className="w-full rounded-xl border border-line" />
          {doc.featuredImage.caption && <figcaption className="mt-2 text-xs text-muted">{doc.featuredImage.caption}</figcaption>}
        </figure>
      )}

      <div className="mt-6 border-t border-line pt-2">{doc.blocks.map(render)}</div>
      <div className="clear-both" />

      {ArticleExport.hasPython(doc) && (
        <div className="mt-12 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface/60 p-5">
          <p className="flex-1 text-sm text-muted">Run the code yourself: every Python block, with the explanations, as a Jupyter notebook.</p>
          <DownloadButton content={ArticleExport.notebook(doc, url)} filename={`${doc.slug}.ipynb`} type="application/x-ipynb+json" label="Notebook (.ipynb)" />
        </div>
      )}

      {doc.sources.length > 0 && (
        <section aria-labelledby="sources" className="mt-14 border-t border-line pt-8">
          <h2 id="sources" className="font-mono text-xs tracking-[0.22em] text-muted uppercase">
            Sources
          </h2>
          <ol className="mt-4 space-y-3 text-sm text-ink/85">
            {doc.sources.map((s, i) => (
              <li key={s.id || i} id={`source-${s.id}`} className="flex scroll-mt-28 gap-3">
                <span className="font-mono text-quant">[{i + 1}]</span>
                <span>
                  {s.citation || (
                    <>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-line underline-offset-2 hover:decoration-quant">
                          {s.title}
                        </a>
                      ) : (
                        s.title
                      )}
                      {s.publisher && `. ${s.publisher}`}
                      {s.accessedAt && <span className="text-muted">. Accessed {s.accessedAt}</span>}.
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {doc.disclaimer && <p className="mt-10 border-l-2 border-line pl-4 text-xs leading-relaxed text-muted">{doc.disclaimer}</p>}

      <div className="mt-12 rounded-xl border border-line bg-surface p-6">
        <p className="font-semibold">{doc.cta ? doc.cta.label : "Want this explained 1-on-1?"}</p>
        {cta.text && <p className="mt-2 text-sm text-muted">{cta.text}</p>}
        <ButtonLink href={cta.href} className="mt-4">
          {doc.cta ? doc.cta.label : siteConfig.navCta.label}
        </ButtonLink>
      </div>
    </article>
  );
}
