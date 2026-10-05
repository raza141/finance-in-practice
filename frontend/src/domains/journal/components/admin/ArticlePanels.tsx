"use client";

import { useState } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";
import { siteConfig } from "@/core/config/site";

import { ArticleContract } from "../../services/ArticleContract";
import { ArticleExport } from "../../services/ArticleExport";
import { JournalFramework } from "../../services/JournalFramework";
import { JournalTaxonomy } from "../../services/JournalTaxonomy";
import type { ArticleDocument, Source } from "../../types";
import { ImageField } from "./ImageField";

type DocProps = { doc: ArticleDocument; onChange: (next: ArticleDocument) => void };

const COUNT = (n: number, lo: number, hi: number) => (n >= lo && n <= hi ? "text-quant" : "text-gold");

/** Comma-separated list input that commits on blur, so typing a comma doesn't fight the cursor. */
function ListInput({ value, onCommit, placeholder, label }: { value: string[]; onCommit: (v: string[]) => void; placeholder?: string; label: string }) {
  return (
    <input
      key={value.join("|")}
      defaultValue={value.join(", ")}
      placeholder={placeholder}
      aria-label={label}
      onBlur={(e) => onCommit(e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
      className={FIELD}
    />
  );
}

export function MetaPanel({ doc, onChange, slugLocked, onSlugEdited }: DocProps & { slugLocked: boolean; onSlugEdited: () => void }) {
  const set = <K extends keyof ArticleDocument>(key: K, value: ArticleDocument[K]) => onChange({ ...doc, [key]: value });
  const fromTakeaway = ArticleExport.excerptFromTakeaway(doc);
  return (
    <div className="space-y-4">
      <Field label="URL slug" hint={slugLocked ? "Locked: the article is live at this URL." : `/journal/${doc.slug || "…"}`}>
        <input
          value={doc.slug}
          disabled={slugLocked}
          onChange={(e) => {
            onSlugEdited();
            set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-"));
          }}
          className={`${FIELD} font-mono text-sm`}
        />
      </Field>
      <Field label="Excerpt *" hint={<span className={COUNT(doc.excerpt.length, 50, 300)}>{doc.excerpt.length}/300 · shown on cards and as the summary</span>}>
        <textarea value={doc.excerpt} rows={3} onChange={(e) => set("excerpt", e.target.value)} className={`${FIELD} field-sizing-content font-sans`} />
      </Field>
      {fromTakeaway && doc.excerpt !== fromTakeaway && (
        <button type="button" onClick={() => set("excerpt", fromTakeaway)} className="-mt-2 text-xs text-quant hover:underline">
          Use the executive takeaway
        </button>
      )}
      <Field label="Format" hint="Changes the framework checklist; existing blocks stay.">
        <select value={doc.format} onChange={(e) => set("format", e.target.value as ArticleDocument["format"])} className={FIELD}>
          {JournalTaxonomy.FORMATS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </Field>
      <Field label="Primary category *">
        <select value={doc.category ?? ""} onChange={(e) => set("category", JournalTaxonomy.isCategory(e.target.value) ? e.target.value : null)} className={FIELD}>
          <option value="">Choose…</option>
          {JournalTaxonomy.CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="Difficulty">
        <select value={doc.difficulty ?? ""} onChange={(e) => set("difficulty", JournalTaxonomy.isDifficulty(e.target.value) ? e.target.value : null)} className={FIELD}>
          <option value="">Choose…</option>
          {JournalTaxonomy.DIFFICULTIES.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </Field>
      <fieldset>
        <legend className="text-[11px] tracking-[0.22em] text-muted uppercase">Audience</legend>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {JournalTaxonomy.AUDIENCES.map((a) => (
            <label key={a} className="flex items-center gap-2 text-xs text-ink/90">
              <input
                type="checkbox"
                checked={doc.audience.includes(a)}
                onChange={(e) => set("audience", e.target.checked ? [...doc.audience, a] : doc.audience.filter((x) => x !== a))}
              />
              {a}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Tags" hint="Comma-separated, e.g. VaR, Python, PSX (max 12)">
        <ListInput label="Tags" value={doc.tags} onCommit={(tags) => set("tags", [...new Set(tags)].slice(0, 12))} />
      </Field>
      <div className="space-y-3 rounded-lg border border-line p-3">
        <ImageField label="Featured image *" url={doc.featuredImage?.url ?? ""} onChange={(url) => set("featuredImage", url ? { alt: "", caption: "", ...doc.featuredImage, url } : null)} />
        {doc.featuredImage && (
          <>
            <Field label="Alt text *">
              <input value={doc.featuredImage.alt} onChange={(e) => set("featuredImage", { ...doc.featuredImage!, alt: e.target.value })} className={FIELD} />
            </Field>
            <Field label="Caption">
              <input value={doc.featuredImage.caption} onChange={(e) => set("featuredImage", { ...doc.featuredImage!, caption: e.target.value })} className={FIELD} />
            </Field>
          </>
        )}
      </div>
      <Field
        label={`Disclaimer${JournalFramework.DISCLAIMER_REQUIRED.includes(doc.format) ? " *" : ""}`}
        hint={doc.disclaimer ? undefined : <button type="button" onClick={() => set("disclaimer", JournalFramework.DEFAULT_DISCLAIMER)} className="text-quant hover:underline">Insert the standard non-advice disclaimer</button>}
      >
        <textarea value={doc.disclaimer} rows={3} onChange={(e) => set("disclaimer", e.target.value)} className={`${FIELD} field-sizing-content font-sans text-sm`} />
      </Field>
      <div className="space-y-3 rounded-lg border border-line p-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={doc.cta !== null} onChange={(e) => set("cta", e.target.checked ? { label: "", href: "", text: "" } : null)} />
          Custom call to action (default: {siteConfig.navCta.label})
        </label>
        {doc.cta && (
          <>
            <Field label="Button label">
              <input value={doc.cta.label} onChange={(e) => set("cta", { ...doc.cta!, label: e.target.value })} placeholder="Join the FRM Part I cohort" className={FIELD} />
            </Field>
            <Field label="Link">
              <input value={doc.cta.href} onChange={(e) => set("cta", { ...doc.cta!, href: e.target.value })} placeholder="/courses/frm-part-1" className={FIELD} />
            </Field>
            <Field label="Supporting line">
              <input value={doc.cta.text} onChange={(e) => set("cta", { ...doc.cta!, text: e.target.value })} className={FIELD} />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

export function SeoPanel({ doc, onChange }: DocProps) {
  const seo = doc.seo;
  const set = <K extends keyof ArticleDocument["seo"]>(key: K, value: string) => onChange({ ...doc, seo: { ...seo, [key]: value } });
  const title = seo.title || doc.title;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-canvas/60 p-3" aria-label="Search result preview">
        <p className="truncate text-xs text-muted">financeinpractice.me › journal › {doc.slug}</p>
        <p className="mt-1 line-clamp-1 text-[15px] text-[#8ab4f8]">{title || "Title"}</p>
        <p className="mt-1 line-clamp-2 text-xs text-ink/75">{seo.description || "Meta description…"}</p>
      </div>
      <Field label="SEO title" hint={<span className={COUNT(title.length, 10, 65)}>{title.length}/65 · blank = article title</span>}>
        <input value={seo.title} placeholder={doc.title} onChange={(e) => set("title", e.target.value)} className={FIELD} />
      </Field>
      <Field label="Meta description *" hint={<span className={COUNT(seo.description.length, 50, 160)}>{seo.description.length}/160</span>}>
        <textarea value={seo.description} rows={3} onChange={(e) => set("description", e.target.value)} className={`${FIELD} field-sizing-content font-sans text-sm`} />
      </Field>
      {!seo.description && doc.excerpt && (
        <button type="button" onClick={() => set("description", doc.excerpt.slice(0, 160))} className="-mt-2 text-xs text-quant hover:underline">
          Start from the excerpt
        </button>
      )}
      <Field label="Canonical URL" hint="Leave blank unless this was first published elsewhere.">
        <input value={seo.canonical} onChange={(e) => set("canonical", e.target.value)} placeholder={`${siteConfig.url}/journal/${doc.slug}`} className={FIELD} />
      </Field>
      <Field label="Open Graph title" hint="Blank = article title">
        <input value={seo.ogTitle} onChange={(e) => set("ogTitle", e.target.value)} className={FIELD} />
      </Field>
      <Field label="Open Graph description" hint="Blank = meta description">
        <textarea value={seo.ogDescription} rows={2} onChange={(e) => set("ogDescription", e.target.value)} className={`${FIELD} font-sans text-sm`} />
      </Field>
      <ImageField label="Open Graph image (blank = featured image)" url={seo.ogImage} onChange={(url) => set("ogImage", url)} />
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="h-9 rounded-md bg-quant/15 px-3 text-xs font-semibold text-quant hover:bg-quant/25"
    >
      {done ? "✓ Copied" : label}
    </button>
  );
}

export function SocialPanel({ doc, onChange }: DocProps) {
  const social = doc.social;
  const set = <K extends keyof ArticleDocument["social"]>(key: K, value: ArticleDocument["social"][K]) => onChange({ ...doc, social: { ...social, [key]: value } });
  const url = `${siteConfig.url}/journal/${doc.slug}`;
  const post = ArticleExport.linkedinText(social);
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => onChange({ ...doc, social: { ...social, ...ArticleExport.linkedinDraft(doc, url), status: social.status === "posted" ? "posted" : "drafted" } })}
        className="h-9 w-full rounded-md border border-quant/50 text-sm text-quant hover:bg-quant/10"
      >
        {social.hook ? "Regenerate from article" : "Generate LinkedIn draft from article"}
      </button>
      <Field label="Hook" hint={<span className={COUNT(social.hook.length, 1, 210)}>{social.hook.length}/210 · shows before “…see more”</span>}>
        <textarea value={social.hook} rows={2} onChange={(e) => set("hook", e.target.value)} className={`${FIELD} font-sans text-sm`} />
      </Field>
      <Field label="Body">
        <textarea value={social.body} rows={6} onChange={(e) => set("body", e.target.value)} className={`${FIELD} field-sizing-content font-sans text-sm`} />
      </Field>
      <Field label="Closing question">
        <input value={social.question} onChange={(e) => set("question", e.target.value)} className={FIELD} />
      </Field>
      <Field label="Hashtags" hint="Comma-separated, without #">
        <ListInput label="Hashtags" value={social.hashtags} onCommit={(tags) => set("hashtags", tags.map((t) => t.replace(/^#/, "").replace(/\s+/g, "")).slice(0, 10))} />
      </Field>
      <ImageField label="Post image (blank = featured image)" url={social.imageUrl} onChange={(url) => set("imageUrl", url)} />
      <Field label="Status">
        <select value={social.status} onChange={(e) => set("status", e.target.value as typeof social.status)} className={FIELD}>
          {ArticleContract.SOCIAL_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      {post && (
        <div className="flex gap-2">
          <CopyButton text={post} label="Copy LinkedIn post" />
          <span className="self-center text-xs text-muted">{post.length}/3000</span>
        </div>
      )}

      <div className="border-t border-line pt-4">
        <p className="text-[11px] tracking-[0.22em] text-muted uppercase">Carousel outline</p>
        <ol className="mt-2 space-y-3">
          {social.carousel.map((slide, i) => (
            <li key={i} className="space-y-1.5 rounded-lg border border-line p-2">
              <div className="flex gap-2">
                <span className="pt-2 font-mono text-xs text-muted">{i + 1}</span>
                <input
                  value={slide.title}
                  aria-label={`Slide ${i + 1} title`}
                  onChange={(e) => set("carousel", social.carousel.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)))}
                  className={`${FIELD} mt-0 text-sm`}
                />
                <button type="button" onClick={() => set("carousel", social.carousel.filter((_, j) => j !== i))} className="px-1 text-muted hover:text-gold" aria-label="Remove slide">
                  ×
                </button>
              </div>
              <textarea
                value={slide.points.join("\n")}
                rows={2}
                aria-label={`Slide ${i + 1} points, one per line`}
                onChange={(e) => set("carousel", social.carousel.map((s, j) => (j === i ? { ...s, points: e.target.value.split("\n").slice(0, 6) } : s)))}
                className={`${FIELD} mt-0 font-sans text-xs`}
              />
            </li>
          ))}
        </ol>
        <div className="mt-2 flex gap-2">
          {social.carousel.length < 12 && (
            <button type="button" onClick={() => set("carousel", [...social.carousel, { title: "", points: [] }])} className="text-xs text-quant hover:underline">
              + Add slide
            </button>
          )}
          {social.carousel.length > 0 && <CopyButton text={ArticleExport.carouselText(social)} label="Copy outline" />}
        </div>
      </div>
    </div>
  );
}

export function SourcesEditor({ doc, onChange }: DocProps) {
  const set = (sources: Source[]) => onChange({ ...doc, sources });
  const update = (i: number, patch: Partial<Source>) => set(doc.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section id="sources" aria-labelledby="sources-heading" className="scroll-mt-24 rounded-xl border border-line bg-surface/40 p-4">
      <h2 id="sources-heading" className="font-mono text-xs tracking-[0.22em] text-muted uppercase">
        Sources &amp; citations
      </h2>
      <p className="mt-1 text-xs text-muted/80">At least one is required. Cite in text with the buttons under each field, or type [^id].</p>
      <ol className="mt-4 space-y-4">
        {doc.sources.map((s, i) => (
          <li key={i} className="grid gap-2 border-l-2 border-quant/30 pl-3 sm:grid-cols-[8rem_1fr]">
            <Field label="Id">
              <input value={s.id} onChange={(e) => update(i, { id: e.target.value.replace(/[^A-Za-z0-9_-]/g, "") })} placeholder="hull-2022" className={`${FIELD} font-mono text-sm`} />
            </Field>
            <Field label="Title">
              <input value={s.title} onChange={(e) => update(i, { title: e.target.value })} className={FIELD} />
            </Field>
            <Field label="Publisher / author">
              <input value={s.publisher} onChange={(e) => update(i, { publisher: e.target.value })} className={FIELD} />
            </Field>
            <Field label="URL">
              <input type="url" value={s.url} onChange={(e) => update(i, { url: e.target.value })} className={FIELD} />
            </Field>
            <Field label="Accessed">
              <input type="date" value={s.accessedAt} onChange={(e) => update(i, { accessedAt: e.target.value })} className={FIELD} />
            </Field>
            <div className="flex items-end gap-2">
              <Field label="Full citation (optional)" className="flex-1">
                <input value={s.citation} onChange={(e) => update(i, { citation: e.target.value })} placeholder="Hull, J. (2022). Options, Futures… 11th ed." className={FIELD} />
              </Field>
              <button type="button" onClick={() => set(doc.sources.filter((_, j) => j !== i))} className="h-10 px-2 text-sm text-muted hover:text-gold" aria-label={`Remove source ${i + 1}`}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => set([...doc.sources, { id: `src${doc.sources.length + 1}`, title: "", publisher: "", url: "", accessedAt: today, citation: "" }])}
        className="mt-4 text-sm text-quant hover:underline"
      >
        + Add source
      </button>
    </section>
  );
}
