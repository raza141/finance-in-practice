"use client";

import { useRef, type ReactNode } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";

import { ArticleContract } from "../../services/ArticleContract";
import { ChartData } from "../../services/ChartData";
import type {
  AsideBlock,
  Block,
  CalloutBlock,
  ChartBlock,
  CodeBlock,
  FaqBlock,
  FormulaBlock,
  HeadingBlock,
  ImageBlock,
  RelatedBlock,
  Source,
  TableBlock,
  TakeawayBlock,
  TextBlock,
} from "../../types";
import { ChartView } from "../ChartView";
import { texToHtml } from "../RichText";
import { ImageField } from "./ImageField";

const AREA = `${FIELD} field-sizing-content min-h-24 resize-y font-sans leading-relaxed`;
const MONO_AREA = `${FIELD} field-sizing-content min-h-32 resize-y font-mono text-[13px] leading-relaxed`;
const SMALL = "text-xs text-muted/80";

export interface BlockEditorContext {
  sources: Source[];
  publishedArticles: { slug: string; title: string }[];
}

type Editor<T extends Block> = (props: { block: T; onChange: (next: T) => void; ctx: BlockEditorContext }) => ReactNode;

/** Textarea for inline markup, with buttons that insert a citation at the cursor. */
function MarkupArea({ value, onChange, sources, rows = 5, placeholder }: { value: string; onChange: (v: string) => void; sources: Source[]; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function insert(text: string) {
    const el = ref.current;
    const at = el ? el.selectionEnd : value.length;
    onChange(value.slice(0, at) + text + value.slice(at));
    requestAnimationFrame(() => el?.focus());
  }
  const citable = sources.filter((s) => s.id);
  return (
    <div>
      <textarea ref={ref} value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={AREA} />
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={SMALL}>**bold** *italic* `code` [link](/courses) $x^2$ · blank line = paragraph · “- ” = list</span>
        {citable.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            <span className={SMALL}>Cite:</span>
            {citable.map((s) => (
              <button key={s.id} type="button" onClick={() => insert(`[^${s.id}]`)} className="rounded border border-line px-1.5 font-mono text-[11px] text-quant hover:border-quant/60">
                {s.id}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

const HeadingEditor: Editor<HeadingBlock> = ({ block, onChange }) => (
  <div className="flex gap-3">
    <select value={block.level} onChange={(e) => onChange({ ...block, level: e.target.value === "3" ? 3 : 2 })} className={`${FIELD} mt-0 w-24`} aria-label="Heading level">
      <option value={2}>H2</option>
      <option value={3}>H3</option>
    </select>
    <input value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} placeholder="Section heading" className={`${FIELD} mt-0 font-serif text-lg`} aria-label="Heading" />
  </div>
);

const TextEditor: Editor<TextBlock> = ({ block, onChange, ctx }) => (
  <MarkupArea value={block.text} onChange={(text) => onChange({ ...block, text })} sources={ctx.sources} rows={6} placeholder="Write…" />
);

const TakeawayEditor: Editor<TakeawayBlock> = ({ block, onChange }) => (
  <div className="space-y-2">
    {block.points.map((p, i) => (
      <div key={i} className="flex gap-2">
        <span aria-hidden className="pt-2.5 text-quant">→</span>
        <input
          value={p}
          onChange={(e) => onChange({ ...block, points: block.points.map((q, j) => (j === i ? e.target.value : q)) })}
          placeholder={i === 0 ? "The one thing a busy reader should remember" : "Supporting point"}
          className={`${FIELD} mt-0`}
          aria-label={`Takeaway point ${i + 1}`}
        />
        <button type="button" onClick={() => onChange({ ...block, points: block.points.filter((_, j) => j !== i) })} className="px-2 text-muted hover:text-gold" aria-label="Remove point">
          ×
        </button>
      </div>
    ))}
    {block.points.length < 4 && (
      <button type="button" onClick={() => onChange({ ...block, points: [...block.points, ""] })} className="text-xs text-quant hover:underline">
        + Add point
      </button>
    )}
  </div>
);

const CalloutEditor: Editor<CalloutBlock> = ({ block, onChange, ctx }) => (
  <div className="space-y-3">
    <div className="flex gap-3">
      <select value={block.tone} onChange={(e) => onChange({ ...block, tone: e.target.value as CalloutBlock["tone"] })} className={`${FIELD} mt-0 w-40`} aria-label="Callout type">
        <option value="note">Note</option>
        <option value="key-insight">Key insight</option>
        <option value="exam-trap">Exam trap</option>
        <option value="warning">Caution</option>
      </select>
      <input value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Title (optional)" className={`${FIELD} mt-0`} aria-label="Callout title" />
    </div>
    <MarkupArea value={block.text} onChange={(text) => onChange({ ...block, text })} sources={ctx.sources} rows={3} />
  </div>
);

const AsideEditor: Editor<AsideBlock> = ({ block, onChange, ctx }) => (
  <div className="space-y-3">
    <select value={block.variant} onChange={(e) => onChange({ ...block, variant: e.target.value === "pullquote" ? "pullquote" : "margin" })} className={`${FIELD} mt-0 w-56`} aria-label="Style">
      <option value="margin">Margin note (floats beside text)</option>
      <option value="pullquote">Pull quote</option>
    </select>
    <MarkupArea value={block.text} onChange={(text) => onChange({ ...block, text })} sources={ctx.sources} rows={2} />
  </div>
);

const FormulaEditor: Editor<FormulaBlock> = ({ block, onChange, ctx }) => (
  <div className="space-y-3">
    <Field label="LaTeX" hint="e.g. \text{VaR}_{\alpha} = \mu - z_{\alpha}\,\sigma\sqrt{t}">
      <textarea value={block.tex} rows={2} onChange={(e) => onChange({ ...block, tex: e.target.value })} className={MONO_AREA} spellCheck={false} />
    </Field>
    {block.tex.trim() && (
      <div className="overflow-x-auto rounded-lg border border-line bg-canvas/60 px-4 py-3" aria-label="Formula preview" dangerouslySetInnerHTML={{ __html: texToHtml(block.tex, true) }} />
    )}
    <div>
      <span className="text-[11px] tracking-[0.22em] text-muted uppercase">What each symbol means</span>
      <MarkupArea value={block.explanation} onChange={(explanation) => onChange({ ...block, explanation })} sources={ctx.sources} rows={3} placeholder="where $\mu$ is the expected return, …" />
    </div>
  </div>
);

const ImageEditor: Editor<ImageBlock> = ({ block, onChange }) => (
  <div className="space-y-3">
    <ImageField url={block.url} onChange={(url) => onChange({ ...block, url })} />
    <Field label="Alt text" hint="What the image shows, for screen readers (required).">
      <input value={block.alt} onChange={(e) => onChange({ ...block, alt: e.target.value })} className={FIELD} />
    </Field>
    <Field label="Caption">
      <input value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })} className={FIELD} />
    </Field>
    <label className="flex items-center gap-2 text-sm text-muted">
      <input type="checkbox" checked={block.chart !== null} onChange={(e) => onChange({ ...block, chart: e.target.checked ? { source: "", asOf: "" } : null })} />
      This is a static chart (source and date required)
    </label>
    {block.chart && (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Data source">
          <input value={block.chart.source} onChange={(e) => onChange({ ...block, chart: { ...block.chart!, source: e.target.value } })} className={FIELD} />
        </Field>
        <Field label="Data as of">
          <input type="date" value={block.chart.asOf} onChange={(e) => onChange({ ...block, chart: { ...block.chart!, asOf: e.target.value } })} className={FIELD} />
        </Field>
      </div>
    )}
  </div>
);

const ChartEditor: Editor<ChartBlock> = ({ block, onChange }) => {
  const set = <K extends keyof ChartBlock>(key: K, value: ChartBlock[K]) => onChange({ ...block, [key]: value });
  const parsed = ChartData.parse(block.csv);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Chart title">
          <input value={block.title} onChange={(e) => set("title", e.target.value)} className={FIELD} />
        </Field>
        <Field label="Type">
          <select value={block.kind} onChange={(e) => set("kind", e.target.value as ChartBlock["kind"])} className={FIELD}>
            {ArticleContract.CHART_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="Data (CSV, or paste from Excel)"
        hint="Header row first. Column 1 = x (dates YYYY-MM-DD, numbers or labels); each other column is a series (max 6)."
        error={block.csv.trim() && !parsed.ok ? parsed.error : undefined}
      >
        <textarea value={block.csv} rows={6} onChange={(e) => set("csv", e.target.value)} className={MONO_AREA} spellCheck={false} placeholder={"date,KSE-100,ADX General\n2026-09-01,81250,9512\n2026-09-02,81710,9530"} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="X label">
          <input value={block.xLabel} onChange={(e) => set("xLabel", e.target.value)} className={FIELD} />
        </Field>
        <Field label="Y label">
          <input value={block.yLabel} onChange={(e) => set("yLabel", e.target.value)} className={FIELD} />
        </Field>
        <Field label="Unit *">
          <input value={block.unit} onChange={(e) => set("unit", e.target.value)} placeholder="%, pts, bn" className={FIELD} />
        </Field>
        <Field label="Currency">
          <input value={block.currency} onChange={(e) => set("currency", e.target.value.toUpperCase().slice(0, 3))} placeholder="PKR" className={FIELD} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_9rem_9rem]">
        <Field label="Data source *">
          <input value={block.source} onChange={(e) => set("source", e.target.value)} placeholder="PSX, ADX, FRED…" className={FIELD} />
        </Field>
        <Field label="Source URL">
          <input type="url" value={block.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} className={FIELD} />
        </Field>
        <Field label="As of *">
          <input type="date" value={block.asOf} onChange={(e) => set("asOf", e.target.value)} className={FIELD} />
        </Field>
        <Field label="Frequency">
          <select value={block.frequency} onChange={(e) => set("frequency", e.target.value as ChartBlock["frequency"])} className={FIELD}>
            {ArticleContract.FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Methodology *" hint="How the numbers were built: rebasing, adjustments, calculations.">
        <textarea value={block.methodology} rows={2} onChange={(e) => set("methodology", e.target.value)} className={AREA} />
      </Field>
      <Field label="Limitations *" hint="What the chart can't tell the reader.">
        <textarea value={block.limitations} rows={2} onChange={(e) => set("limitations", e.target.value)} className={AREA} />
      </Field>
      <Field label="Alt text *" hint="The chart's takeaway in one sentence, for screen readers.">
        <input value={block.alt} onChange={(e) => set("alt", e.target.value)} className={FIELD} />
      </Field>
      <Field label="Caption">
        <input value={block.caption} onChange={(e) => set("caption", e.target.value)} className={FIELD} />
      </Field>
      {parsed.ok && (
        <div className="rounded-lg border border-dashed border-line px-4">
          <p className="pt-3 font-mono text-[11px] tracking-[0.2em] text-muted uppercase">Live preview</p>
          <ChartView block={block} />
        </div>
      )}
    </div>
  );
};

const CodeEditor: Editor<CodeBlock> = ({ block, onChange, ctx }) => {
  const set = <K extends keyof CodeBlock>(key: K, value: CodeBlock[K]) => onChange({ ...block, [key]: value });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_12rem]">
        <Field label="Title">
          <input value={block.title} onChange={(e) => set("title", e.target.value)} placeholder="Historical VaR in pandas" className={FIELD} />
        </Field>
        <Field label="Language">
          <select value={block.language} onChange={(e) => set("language", e.target.value as CodeBlock["language"])} className={FIELD}>
            {ArticleContract.LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Download filename">
          <input value={block.filename} onChange={(e) => set("filename", e.target.value)} placeholder="historical_var.py" className={FIELD} />
        </Field>
      </div>
      <div>
        <span className="text-[11px] tracking-[0.22em] text-muted uppercase">Explanation *</span>
        <MarkupArea value={block.explanation} onChange={(v) => set("explanation", v)} sources={ctx.sources} rows={2} placeholder="What this code does and why." />
      </div>
      <Field label="Code">
        <textarea
          value={block.code}
          rows={10}
          spellCheck={false}
          onChange={(e) => set("code", e.target.value)}
          onKeyDown={(e) => {
            // Tab indents instead of leaving the field; Esc then Tab moves focus on.
            if (e.key !== "Tab" || e.shiftKey) return;
            e.preventDefault();
            const el = e.currentTarget;
            const at = el.selectionStart;
            set("code", `${block.code.slice(0, at)}    ${block.code.slice(el.selectionEnd)}`);
            requestAnimationFrame(() => el.setSelectionRange(at + 4, at + 4));
          }}
          className={`${MONO_AREA} bg-[#22272e]`}
        />
      </Field>
      <Field label="Output (optional)">
        <textarea value={block.output} rows={3} onChange={(e) => set("output", e.target.value)} className={MONO_AREA} spellCheck={false} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Dependencies" hint="Comma-separated, e.g. pandas, numpy">
          <input
            defaultValue={block.dependencies.join(", ")}
            onBlur={(e) => set("dependencies", e.target.value.split(",").map((d) => d.trim()).filter(Boolean))}
            className={FIELD}
          />
        </Field>
        <Field label="Data source">
          <input value={block.dataSource} onChange={(e) => set("dataSource", e.target.value)} className={FIELD} />
        </Field>
        <Field label="Limitations">
          <input value={block.limitations} onChange={(e) => set("limitations", e.target.value)} className={FIELD} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={block.downloadable} onChange={(e) => set("downloadable", e.target.checked)} />
        Readers can download this as a file
      </label>
    </div>
  );
};

const TableEditor: Editor<TableBlock> = ({ block, onChange }) => (
  <div className="space-y-3">
    <Field label="Caption *">
      <input value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })} className={FIELD} />
    </Field>
    <Field label="Rows (CSV, or paste from Excel)" hint="Header row first. Cells accept inline markup.">
      <textarea value={block.csv} rows={5} onChange={(e) => onChange({ ...block, csv: e.target.value })} className={MONO_AREA} spellCheck={false} />
    </Field>
    <Field label="Source">
      <input value={block.source} onChange={(e) => onChange({ ...block, source: e.target.value })} className={FIELD} />
    </Field>
  </div>
);

const FaqEditor: Editor<FaqBlock> = ({ block, onChange, ctx }) => {
  const setItem = (i: number, patch: Partial<FaqBlock["items"][number]>) =>
    onChange({ ...block, items: block.items.map((item, j) => (j === i ? { ...item, ...patch } : item)) });
  return (
    <div className="space-y-4">
      {block.items.map((item, i) => (
        <div key={i} className="space-y-2 border-l border-line pl-3">
          <div className="flex gap-2">
            <input value={item.q} onChange={(e) => setItem(i, { q: e.target.value })} placeholder="Question" className={`${FIELD} mt-0 font-semibold`} aria-label={`Question ${i + 1}`} />
            <button type="button" onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })} className="px-2 text-muted hover:text-gold" aria-label="Remove question">
              ×
            </button>
          </div>
          <MarkupArea value={item.a} onChange={(a) => setItem(i, { a })} sources={ctx.sources} rows={2} placeholder="Answer" />
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...block, items: [...block.items, { q: "", a: "" }] })} className="text-xs text-quant hover:underline">
        + Add question
      </button>
    </div>
  );
};

const RelatedEditor: Editor<RelatedBlock> = ({ block, onChange, ctx }) =>
  ctx.publishedArticles.length === 0 ? (
    <p className={SMALL}>No other published articles yet.</p>
  ) : (
    <fieldset className="max-h-56 space-y-1.5 overflow-y-auto">
      <legend className="sr-only">Related articles</legend>
      {ctx.publishedArticles.map((a) => (
        <label key={a.slug} className="flex items-center gap-2 text-sm text-ink/90">
          <input
            type="checkbox"
            checked={block.slugs.includes(a.slug)}
            disabled={!block.slugs.includes(a.slug) && block.slugs.length >= 6}
            onChange={(e) => onChange({ ...block, slugs: e.target.checked ? [...block.slugs, a.slug] : block.slugs.filter((s) => s !== a.slug) })}
          />
          {a.title}
        </label>
      ))}
    </fieldset>
  );

/** The form for one block, chosen by its type. */
export function BlockEditor({ block, onChange, ctx }: { block: Block; onChange: (next: Block) => void; ctx: BlockEditorContext }) {
  switch (block.type) {
    case "heading":
      return <HeadingEditor block={block} onChange={onChange} ctx={ctx} />;
    case "text":
      return <TextEditor block={block} onChange={onChange} ctx={ctx} />;
    case "takeaway":
      return <TakeawayEditor block={block} onChange={onChange} ctx={ctx} />;
    case "callout":
      return <CalloutEditor block={block} onChange={onChange} ctx={ctx} />;
    case "aside":
      return <AsideEditor block={block} onChange={onChange} ctx={ctx} />;
    case "formula":
      return <FormulaEditor block={block} onChange={onChange} ctx={ctx} />;
    case "image":
      return <ImageEditor block={block} onChange={onChange} ctx={ctx} />;
    case "chart":
      return <ChartEditor block={block} onChange={onChange} ctx={ctx} />;
    case "code":
      return <CodeEditor block={block} onChange={onChange} ctx={ctx} />;
    case "table":
      return <TableEditor block={block} onChange={onChange} ctx={ctx} />;
    case "faq":
      return <FaqEditor block={block} onChange={onChange} ctx={ctx} />;
    case "related":
      return <RelatedEditor block={block} onChange={onChange} ctx={ctx} />;
  }
}
