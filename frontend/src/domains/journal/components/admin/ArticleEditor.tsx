"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { FIELD } from "@/domains/admin/components/FormField";
import type { AdminRole } from "@/domains/admin/types";

import {
  autosaveArticle,
  checkpointArticle,
  deleteArticle,
  duplicateArticle,
  publishArticle,
  requestChanges,
  restoreRevision,
  runAiReview,
  setArticleArchived,
  submitArticle,
  unpublishArticle,
} from "../../actions/articles";
import { ArticleContract } from "../../services/ArticleContract";
import { ArticleExport } from "../../services/ArticleExport";
import { ArticleValidator, type ValidationIssue } from "../../services/ArticleValidator";
import { BlockFactory } from "../../services/BlockFactory";
import { JournalDates } from "../../services/JournalDates";
import { JournalFramework } from "../../services/JournalFramework";
import type { AiReview, ArticleDocument, ArticleRecord, Block, BlockType, Revision } from "../../types";
import { MetaPanel, SeoPanel, SocialPanel, SourcesEditor } from "./ArticlePanels";
import { BlockEditor } from "./BlockEditor";

type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";
type Tab = "publish" | "meta" | "seo" | "social" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "publish", label: "Publish" },
  { id: "meta", label: "Meta" },
  { id: "seo", label: "SEO" },
  { id: "social", label: "Social" },
  { id: "history", label: "History" },
];

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "All changes saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  conflict: "Changed in another tab",
  error: "Not saved",
};

const BUTTON = "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export interface ArticleEditorProps {
  article: ArticleRecord;
  viewer: { id: string; role: AdminRole };
  aiEnabled: boolean;
  revisions: Revision[];
  publishedArticles: { slug: string; title: string }[];
}

/**
 * The research editor: structure rail on the left, blocks in the centre,
 * publishing inspector on the right. Drafts autosave to the database, so
 * an article can be written over days from any device.
 */
export function ArticleEditor({ article, viewer, aiEnabled, revisions, publishedArticles }: ArticleEditorProps) {
  const router = useRouter();
  const [doc, setDoc] = useState<ArticleDocument>(article.draft);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [slugNote, setSlugNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("publish");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [addType, setAddType] = useState<BlockType>("text");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string; issues?: ValidationIssue[] } | null>(null);
  const [aiReview, setAiReview] = useState<AiReview | null>(article.aiReview);
  const [publishAt, setPublishAt] = useState("");
  const [slugAuto, setSlugAuto] = useState(!article.published && (doc.slug.startsWith("draft-") || doc.slug === ArticleContract.slugify(doc.title)));

  const versionRef = useRef(article.version);
  const docRef = useRef(doc);
  const savedDocRef = useRef(article.draft);
  const savingRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOwner = viewer.role === "owner";
  const slugLocked = article.published !== null;
  const publishedSlugs = new Set(publishedArticles.map((a) => a.slug));
  const issues = ArticleValidator.check(doc, { publishedSlugs });
  const errors = issues.filter((i) => i.level === "error");
  const checklist = JournalFramework.checklist(doc);
  const live = article.status === "published" && article.datePublished !== null && new Date(article.datePublished) <= new Date();
  const scheduled = article.status === "published" && !live;
  const ctx = { sources: doc.sources, publishedArticles: publishedArticles.filter((a) => a.slug !== doc.slug) };

  /* ------------------------------ saving ------------------------------ */

  async function save(): Promise<void> {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (savingRef.current) await savingRef.current;
    const snapshot = docRef.current;
    setSaveState("saving");
    const run = (async () => {
      const result = await autosaveArticle(article.id, versionRef.current, JSON.stringify(snapshot));
      if (result.status === "saved") {
        versionRef.current = result.version;
        savedDocRef.current = snapshot;
        setSlugNote(result.slugTaken ? `“${snapshot.slug}” is taken; the URL stays /journal/${result.slug}.` : null);
        setSaveError(null);
        setSaveState(docRef.current === snapshot ? "saved" : "dirty");
      } else if (result.status === "conflict") {
        setSaveState("conflict");
      } else {
        setSaveError(result.status === "invalid" ? result.error : result.status === "missing" ? "This article was deleted." : "You can't edit this article.");
        setSaveState("error");
      }
    })().catch(() => {
      setSaveError("Network error. Retrying when you next edit.");
      setSaveState("error");
    });
    savingRef.current = run;
    await run;
    savingRef.current = null;
  }

  /** Save now if anything is pending; resolves false when the draft can't be saved. */
  async function flush(): Promise<boolean> {
    if (saveState === "conflict") return false;
    if (savingRef.current) await savingRef.current;
    if (docRef.current !== savedDocRef.current) await save();
    return docRef.current === savedDocRef.current;
  }

  /** Every edit goes through here: update the document and schedule an autosave. */
  function edit(next: ArticleDocument | ((d: ArticleDocument) => ArticleDocument)) {
    const value = typeof next === "function" ? next(docRef.current) : next;
    docRef.current = value;
    setDoc(value);
    if (saveState === "conflict") return;
    setSaveState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), 1500);
  }

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  /* --------------------------- block editing --------------------------- */

  const update = (next: ArticleDocument) => edit(next);
  const setBlocks = (blocks: Block[]) => edit((d) => ({ ...d, blocks }));
  const updateBlock = (next: Block) => edit((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === next.id ? next : b)) }));

  function addBlock(type: BlockType, role?: Block["role"]) {
    const section = role ? JournalFramework.sections(doc.format).find((s) => s.role === role) : undefined;
    const block = BlockFactory.create(type, role, { tone: section?.tone, title: type === "callout" ? section?.label : undefined });
    const at = selected ? doc.blocks.findIndex((b) => b.id === selected) + 1 : doc.blocks.length;
    setBlocks([...doc.blocks.slice(0, at), block, ...doc.blocks.slice(at)]);
    setSelected(block.id);
    requestAnimationFrame(() => focusBlock(block.id));
  }

  function move(id: string, delta: number) {
    const i = doc.blocks.findIndex((b) => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= doc.blocks.length) return;
    const blocks = [...doc.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    setBlocks(blocks);
  }

  function moveTo(id: string, targetId: string) {
    if (id === targetId) return;
    const block = doc.blocks.find((b) => b.id === id)!;
    const rest = doc.blocks.filter((b) => b.id !== id);
    const at = rest.findIndex((b) => b.id === targetId);
    setBlocks([...rest.slice(0, at), block, ...rest.slice(at)]);
  }

  function remove(id: string) {
    const block = doc.blocks.find((b) => b.id === id);
    if (block && BlockFactory.isFilled(block) && !window.confirm("Delete this block? You can restore it from History.")) return;
    setBlocks(doc.blocks.filter((b) => b.id !== id));
    if (selected === id) setSelected(null);
  }

  function duplicate(id: string) {
    const i = doc.blocks.findIndex((b) => b.id === id);
    const copy = { ...structuredClone(doc.blocks[i]), id: BlockFactory.id() };
    delete copy.role;
    setBlocks([...doc.blocks.slice(0, i + 1), copy, ...doc.blocks.slice(i + 1)]);
  }

  function focusBlock(id: string) {
    setMode("edit");
    setSelected(id);
    document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goTo(issue: ValidationIssue) {
    if (issue.blockId) focusBlock(issue.blockId);
    else if (issue.panel === "sources") {
      setMode("edit");
      document.getElementById("sources")?.scrollIntoView({ behavior: "smooth" });
    } else if (issue.panel) openTab(issue.panel);
  }

  function openTab(next: Tab) {
    setTab(next);
    setInspectorOpen(true);
  }

  /* ----------------------------- shortcuts ----------------------------- */

  async function togglePreview() {
    if (mode === "preview") return setMode("edit");
    await flush();
    setPreviewKey((k) => k + 1);
    setMode("preview");
  }


  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void (async () => {
          await save();
          const r = await checkpointArticle(article.id);
          setNotice({ ok: r.ok, text: r.ok ? `Checkpoint saved ${new Date().toLocaleTimeString()}` : r.message });
        })();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        void togglePreview();
      } else if (e.altKey && selected && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        move(selected, e.key === "ArrowUp" ? -1 : 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ----------------------------- workflow ----------------------------- */

  async function act(label: string, run: () => Promise<{ ok: boolean; message?: string; issues?: ValidationIssue[] } | void>) {
    setBusy(label);
    setNotice(null);
    try {
      if (!(await flush())) {
        setNotice({ ok: false, text: "Resolve the save conflict first (reload the page)." });
        return;
      }
      const result = await run();
      if (result) setNotice({ ok: result.ok, text: result.message ?? (result.ok ? "Done." : "Something went wrong."), issues: result.issues });
      if (result?.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const form = (fields: Record<string, string>) => {
    const fd = new FormData();
    fd.set("id", article.id);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  };

  const statusLine = live
    ? article.published && JSON.stringify(article.published) !== JSON.stringify(doc)
      ? "Live · unpublished changes"
      : "Live"
    : scheduled
      ? `Scheduled · ${JournalDates.stamp(article.datePublished!)} GST`
      : article.status === "archived"
        ? "Archived"
        : "Draft";

  /* ------------------------------- render ------------------------------- */

  return (
    <div className="-m-5 sm:-m-8 lg:-m-10">
      {/* Toolbar */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-canvas/95 px-5 py-3 backdrop-blur">
        <Link href="/admin/journal" className="text-sm text-muted hover:text-ink">
          ← Research
        </Link>
        <span className="font-mono text-[11px] tracking-wider text-quant uppercase">{statusLine}</span>
        {article.reviewState && (
          <span className={`font-mono text-[11px] tracking-wider uppercase ${article.reviewState === "pending" ? "text-gold" : "text-red-300"}`}>
            {article.reviewState === "pending" ? "● In review" : "● Changes requested"}
          </span>
        )}
        <span
          role="status"
          className={`text-xs ${saveState === "saved" ? "text-muted" : saveState === "saving" || saveState === "dirty" ? "text-ink/80" : "text-gold"}`}
          title={saveError ?? undefined}
        >
          {saveState === "dirty" && <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-gold align-middle" />}
          {SAVE_LABEL[saveState]}
          {saveError && ` · ${saveError}`}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="group" aria-label="View" className="flex rounded-md border border-line p-0.5">
            <button type="button" onClick={() => setMode("edit")} aria-pressed={mode === "edit"} className={`${BUTTON} h-8 ${mode === "edit" ? "bg-surface-raised text-ink" : "text-muted"}`}>
              Edit
            </button>
            <button type="button" onClick={() => void togglePreview()} aria-pressed={mode === "preview"} className={`${BUTTON} h-8 ${mode === "preview" ? "bg-surface-raised text-ink" : "text-muted"}`}>
              Preview
            </button>
          </div>
          {mode === "preview" && (
            <div role="group" aria-label="Device" className="flex rounded-md border border-line p-0.5">
              {(["desktop", "mobile"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} className={`${BUTTON} h-8 capitalize ${device === d ? "bg-surface-raised text-ink" : "text-muted"}`}>
                  {d}
                </button>
              ))}
            </div>
          )}
          <nav aria-label="Inspector" className="flex gap-1 2xl:hidden">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => openTab(t.id)} className={`${BUTTON} h-8 border border-line text-muted hover:text-ink`}>
                {t.label}
                {t.id === "publish" && errors.length > 0 && <span className="ml-1.5 rounded-full bg-gold/20 px-1.5 text-[10px] text-gold">{errors.length}</span>}
              </button>
            ))}
          </nav>
        </div>
        {saveState === "conflict" && (
          <p role="alert" className="w-full rounded-md border border-gold/50 bg-gold/10 px-3 py-2 text-sm text-gold">
            This article was saved from another tab or device since you opened it, so autosave stopped to avoid overwriting it.{" "}
            <button type="button" onClick={() => window.location.reload()} className="underline">
              Reload the latest version
            </button>{" "}
            (edits made here since the last save will be lost).
          </p>
        )}
        {article.reviewNote && article.reviewState === "changes-requested" && (
          <p className="w-full rounded-md border border-red-400/40 bg-red-400/5 px-3 py-2 text-sm text-ink/90">
            <span className="font-mono text-[11px] tracking-wider text-red-300 uppercase">Reviewer: </span>
            {article.reviewNote}
          </p>
        )}
      </header>

      <div className="grid gap-6 p-5 xl:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[15rem_minmax(0,1fr)_24rem]">
        {/* Structure rail */}
        <aside aria-label="Article structure" className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <details open className="group">
            <summary className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase xl:list-none">{doc.format} framework</summary>
            <ol className="mt-3 space-y-1">
              {checklist.map((s) => (
                <li key={s.role}>
                  <button
                    type="button"
                    onClick={() => (s.blockId ? focusBlock(s.blockId) : addBlock(s.type, s.role))}
                    className="flex w-full items-start gap-2 rounded px-2 py-1 text-left text-sm hover:bg-surface"
                    title={s.hint}
                  >
                    <span aria-hidden className={s.state === "done" ? "text-quant" : s.required ? "text-gold" : "text-muted"}>
                      {s.state === "done" ? "✓" : s.state === "empty" ? "◐" : "○"}
                    </span>
                    <span className={s.state === "done" ? "text-ink/80" : "text-ink"}>
                      {s.label}
                      {!s.required && <span className="text-muted"> (optional)</span>}
                      {s.state === "missing" && <span className="block text-[11px] text-quant">+ add section</span>}
                    </span>
                    <span className="sr-only">{s.state === "done" ? "done" : s.state}</span>
                  </button>
                </li>
              ))}
            </ol>
          </details>

          <p className="mt-6 font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Blocks</p>
          <p className="mt-1 text-[11px] text-muted/70">Drag, or select and press Alt+↑/↓</p>
          <ol className="mt-2 space-y-0.5">
            {doc.blocks.map((b, i) => (
              <li
                key={b.id}
                draggable
                onDragStart={() => setDragId(b.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && moveTo(dragId, b.id)}
                className={`group/item flex items-center gap-1 rounded text-xs ${selected === b.id ? "bg-surface-raised" : "hover:bg-surface"} ${dragId === b.id ? "opacity-40" : ""}`}
              >
                <span aria-hidden className="cursor-grab px-1 text-muted/60">⋮⋮</span>
                <button type="button" onClick={() => focusBlock(b.id)} className={`min-w-0 flex-1 truncate py-1.5 text-left ${b.type === "heading" ? "font-semibold text-ink" : "text-muted"}`}>
                  {BlockFactory.summary(b)}
                </button>
                <span className="hidden gap-0.5 pr-1 group-hover/item:flex group-focus-within/item:flex">
                  <button type="button" disabled={i === 0} onClick={() => move(b.id, -1)} className="px-1 text-muted hover:text-ink disabled:opacity-30" aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" disabled={i === doc.blocks.length - 1} onClick={() => move(b.id, 1)} className="px-1 text-muted hover:text-ink disabled:opacity-30" aria-label="Move down">
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex gap-2">
            <select value={addType} onChange={(e) => setAddType(e.target.value as BlockType)} className={`${FIELD} mt-0 h-9 py-0 text-xs`} aria-label="Block type to add">
              {BlockFactory.TYPES.map((t) => (
                <option key={t} value={t}>
                  {BlockFactory.LABELS[t]}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => addBlock(addType)} className={`${BUTTON} h-9 shrink-0 bg-quant/15 text-quant hover:bg-quant/25`}>
              Add
            </button>
          </div>
          <p className="mt-6 text-[11px] leading-relaxed text-muted/70">
            ⌘/Ctrl+S checkpoint · ⌘/Ctrl+Shift+P preview · Alt+↑/↓ move block
          </p>
        </aside>

        {/* Canvas */}
        <main className="min-w-0">
          {mode === "preview" ? (
            <div className="flex justify-center">
              <iframe
                key={previewKey}
                title="Article preview"
                src={`/admin/preview/${article.id}?v=${previewKey}`}
                className={`h-[calc(100vh-9rem)] rounded-xl border border-line bg-canvas ${device === "mobile" ? "w-[390px]" : "w-full"}`}
              />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              <input
                value={doc.title}
                onChange={(e) => {
                  const title = e.target.value;
                  edit((d) => ({ ...d, title, ...(slugAuto && { slug: ArticleContract.slugify(title) || d.slug }) }));
                }}
                placeholder="Article title"
                aria-label="Title"
                className="w-full border-0 bg-transparent font-serif text-3xl leading-tight font-black text-ink outline-none placeholder:text-muted/50 sm:text-4xl"
              />
              <input
                value={doc.subtitle}
                onChange={(e) => edit((d) => ({ ...d, subtitle: e.target.value }))}
                placeholder="Subtitle (optional)"
                aria-label="Subtitle"
                className="w-full border-0 bg-transparent font-sans text-lg text-muted outline-none placeholder:text-muted/40"
              />
              {slugNote && (
                <p role="alert" className="text-xs text-gold">
                  {slugNote}
                </p>
              )}
              <p className="font-mono text-xs text-muted">
                /journal/{doc.slug} · {ArticleExport.readingMinutes(doc)} min read · by {article.authorName}
              </p>

              {doc.blocks.map((b) => {
                const section = b.role ? checklist.find((s) => s.role === b.role) : undefined;
                return (
                  <section
                    key={b.id}
                    id={`block-${b.id}`}
                    onFocusCapture={() => setSelected(b.id)}
                    className={`scroll-mt-24 rounded-xl border p-4 transition-colors ${selected === b.id ? "border-quant/50 bg-surface/60" : "border-line bg-surface/30"}`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span className="font-mono text-[11px] tracking-wider text-muted uppercase">{BlockFactory.LABELS[b.type]}</span>
                      {section && <span className="rounded bg-quant/10 px-1.5 py-0.5 font-mono text-[10px] text-quant">{section.label}</span>}
                      {issues.some((i) => i.blockId === b.id && i.level === "error") && (
                        <span className="text-[11px] text-gold" title={issues.filter((i) => i.blockId === b.id).map((i) => i.message).join("\n")}>
                          ● needs attention
                        </span>
                      )}
                      <span className="ml-auto flex gap-1 text-xs">
                        <button type="button" onClick={() => move(b.id, -1)} className="px-1.5 text-muted hover:text-ink" aria-label="Move block up">
                          ↑
                        </button>
                        <button type="button" onClick={() => move(b.id, 1)} className="px-1.5 text-muted hover:text-ink" aria-label="Move block down">
                          ↓
                        </button>
                        <button type="button" onClick={() => duplicate(b.id)} className="px-1.5 text-muted hover:text-ink">
                          Duplicate
                        </button>
                        <button type="button" onClick={() => remove(b.id)} className="px-1.5 text-muted hover:text-gold">
                          Delete
                        </button>
                      </span>
                    </div>
                    {section && !BlockFactory.isFilled(b) && <p className="-mt-1 mb-2 text-xs text-muted/80">{section.hint}</p>}
                    <BlockEditor block={b} onChange={updateBlock} ctx={ctx} />
                  </section>
                );
              })}

              <SourcesEditor doc={doc} onChange={update} />
            </div>
          )}
        </main>

        {/* Inspector: a column on very wide screens, a drawer otherwise */}
        <aside
          aria-label="Publishing inspector"
          className={`fixed inset-y-0 right-0 z-40 w-[min(26rem,100vw)] overflow-y-auto border-l border-line bg-canvas p-5 shadow-2xl ${inspectorOpen ? "" : "hidden"} 2xl:sticky 2xl:top-20 2xl:z-auto 2xl:block 2xl:max-h-[calc(100vh-6rem)] 2xl:w-auto 2xl:border-0 2xl:bg-transparent 2xl:p-0 2xl:shadow-none`}
        >
          <div className="mb-4 flex items-center gap-1">
            <div role="tablist" aria-label="Inspector" className="flex flex-1 flex-wrap gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`${BUTTON} h-8 ${tab === t.id ? "bg-surface-raised text-ink" : "text-muted hover:text-ink"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setInspectorOpen(false)} className="px-2 text-muted hover:text-ink 2xl:hidden" aria-label="Close inspector">
              ✕
            </button>
          </div>

          {tab === "meta" && <MetaPanel doc={doc} onChange={update} slugLocked={slugLocked} onSlugEdited={() => setSlugAuto(false)} />}
          {tab === "seo" && <SeoPanel doc={doc} onChange={update} />}
          {tab === "social" && <SocialPanel doc={doc} onChange={update} />}

          {tab === "history" && (
            <div className="space-y-3">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void act("checkpoint", () => checkpointArticle(article.id))}
                className={`${BUTTON} w-full border border-line text-muted hover:text-ink`}
              >
                Save a checkpoint (⌘/Ctrl+S)
              </button>
              {revisions.length === 0 ? (
                <p className="text-sm text-muted">No revisions yet. Publishing, submitting and checkpoints create them.</p>
              ) : (
                <ol className="divide-y divide-line border-y border-line">
                  {revisions.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          <span className="font-mono text-[11px] tracking-wider text-quant uppercase">{r.kind}</span> · {JournalDates.stamp(r.createdAt)}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {r.authorName} · {r.title || "Untitled"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => {
                          if (window.confirm("Replace the current draft with this revision? The current draft is kept in History.")) {
                            void act("restore", async () => {
                              await checkpointArticle(article.id);
                              await restoreRevision(form({ revisionId: r.id }));
                            });
                          }
                        }}
                        className="text-xs text-quant hover:underline"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {tab === "publish" && (
            <div className="space-y-5">
              <section aria-label="Checklist">
                <p className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
                  Checklist · {errors.length === 0 ? <span className="text-quant">ready</span> : <span className="text-gold">{errors.length} to fix</span>}
                </p>
                <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                  {issues.map((issue, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => goTo(issue)} className="flex w-full gap-2 rounded px-1 py-1 text-left text-xs hover:bg-surface">
                        <span aria-hidden className={issue.level === "error" ? "text-gold" : "text-muted"}>
                          {issue.level === "error" ? "●" : "○"}
                        </span>
                        <span className={issue.level === "error" ? "text-ink/90" : "text-muted"}>{issue.message}</span>
                      </button>
                    </li>
                  ))}
                  {issues.length === 0 && <li className="text-xs text-quant">✓ Everything checks out.</li>}
                </ul>
              </section>

              {notice && (
                <div role="status" className={`rounded-md border px-3 py-2 text-sm ${notice.ok ? "border-quant/40 text-quant" : "border-gold/50 text-gold"}`}>
                  {notice.text}
                </div>
              )}

              {isOwner ? (
                <section aria-label="Publish" className="space-y-3 rounded-xl border border-line p-4">
                  {article.reviewState === "pending" && (
                    <p className="text-sm text-gold">
                      {article.authorName} submitted this for review. Publishing approves it.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={busy !== null || errors.length > 0}
                    onClick={() => void act("publish", () => publishArticle(article.id, versionRef.current, null))}
                    className={`${BUTTON} w-full bg-gold font-semibold text-canvas hover:bg-gold-bright`}
                  >
                    {busy === "publish" ? "Publishing…" : live ? "Update live article" : article.reviewState === "pending" ? "Approve & publish now" : "Publish now"}
                  </button>
                  {!live && (
                    <div className="flex items-end gap-2">
                      <label className="flex-1">
                        <span className="text-[11px] tracking-[0.22em] text-muted uppercase">Or schedule (your time)</span>
                        <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className={`${FIELD} text-sm`} />
                      </label>
                      <button
                        type="button"
                        disabled={busy !== null || errors.length > 0 || !publishAt || new Date(publishAt) <= new Date()}
                        onClick={() => void act("schedule", () => publishArticle(article.id, versionRef.current, new Date(publishAt).toISOString()))}
                        className={`${BUTTON} h-10 border border-gold/60 text-gold hover:bg-gold/10`}
                      >
                        Schedule
                      </button>
                    </div>
                  )}
                  {errors.length > 0 && <p className="text-xs text-muted">Publishing unlocks when the checklist has no errors.</p>}
                  {article.reviewState === "pending" && (
                    <details className="rounded-lg border border-line p-3">
                      <summary className="text-sm text-muted hover:text-ink">Request changes…</summary>
                      <form
                        action={async (fd) => {
                          fd.set("id", article.id);
                          await requestChanges(fd);
                          router.refresh();
                        }}
                        className="mt-2 space-y-2"
                      >
                        <textarea name="note" rows={3} required placeholder="What needs to change before this can go live?" className={`${FIELD} font-sans text-sm`} />
                        <button type="submit" className={`${BUTTON} border border-line text-ink hover:bg-surface`}>
                          Send back to {article.authorName}
                        </button>
                      </form>
                    </details>
                  )}
                  {article.status === "published" && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (window.confirm(live ? "Take this article offline? Its URL will return 404." : "Cancel the scheduled publication?"))
                          void act("unpublish", async () => {
                            await unpublishArticle(form({}));
                            return { ok: true, message: live ? "Unpublished." : "Schedule cancelled." };
                          });
                      }}
                      className={`${BUTTON} w-full text-muted hover:text-ink`}
                    >
                      {live ? "Unpublish" : "Cancel schedule"}
                    </button>
                  )}
                </section>
              ) : (
                <section aria-label="Submit for review" className="space-y-3 rounded-xl border border-line p-4">
                  <p className="text-sm text-muted">
                    {article.reviewState === "pending"
                      ? "Waiting for an owner to review. You can keep editing; resubmit to send the latest version."
                      : "When the checklist is clear, submit this for an owner to review and publish."}
                  </p>
                  <button
                    type="button"
                    disabled={busy !== null || errors.length > 0}
                    onClick={() => void act("submit", () => submitArticle(article.id, versionRef.current))}
                    className={`${BUTTON} w-full bg-gold font-semibold text-canvas hover:bg-gold-bright`}
                  >
                    {busy === "submit" ? "Submitting…" : article.reviewState === "pending" ? "Resubmit for review" : "Submit for review"}
                  </button>
                </section>
              )}

              {notice?.issues && notice.issues.length > 0 && (
                <ul className="space-y-1 text-xs text-gold">
                  {notice.issues.map((i, n) => (
                    <li key={n}>● {i.message}</li>
                  ))}
                </ul>
              )}

              <section aria-label="AI review" className="space-y-3 rounded-xl border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">AI editorial review</p>
                  <button
                    type="button"
                    disabled={!aiEnabled || busy !== null}
                    title={aiEnabled ? undefined : "Set ANTHROPIC_API_KEY to enable"}
                    onClick={() =>
                      void act("ai", async () => {
                        const r = await runAiReview(article.id);
                        if (r.ok) setAiReview(r.review);
                        return r.ok ? { ok: true, message: "AI review ready." } : r;
                      })
                    }
                    className={`${BUTTON} h-8 border border-quant/50 text-xs text-quant hover:bg-quant/10`}
                  >
                    {busy === "ai" ? "Reviewing… (≈1 min)" : aiReview ? "Review again" : "Run review"}
                  </button>
                </div>
                {!aiEnabled && <p className="text-xs text-muted">Off: add ANTHROPIC_API_KEY to the environment to enable.</p>}
                <p className="text-xs text-muted/80">Advisory only. Checks accuracy, unsupported claims, advice wording, chart and code provenance.</p>
                {aiReview && (
                  <div className="space-y-2">
                    <p className="text-sm text-ink/90">{aiReview.summary}</p>
                    <ul className="space-y-2">
                      {aiReview.findings.map((f, i) => (
                        <li key={i} className="border-l-2 pl-2 text-xs leading-relaxed" style={{ borderColor: f.severity === "issue" ? "var(--color-gold)" : "var(--color-line)" }}>
                          <span className={f.severity === "issue" ? "text-gold" : "text-muted"}>{f.where}: </span>
                          <span className="text-ink/85">{f.comment}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-muted/70">
                      {aiReview.model} · {JournalDates.stamp(aiReview.at)}
                    </p>
                  </div>
                )}
              </section>

              <section aria-label="More actions" className="space-y-2 border-t border-line pt-4 text-sm">
                {live && (
                  <a href={`/journal/${article.published?.slug ?? doc.slug}`} target="_blank" rel="noreferrer" className="block text-quant hover:underline">
                    View live article ↗
                  </a>
                )}
                <button type="button" disabled={busy !== null} onClick={() => void act("duplicate", () => duplicateArticle(form({})))} className="block text-muted hover:text-ink">
                  Duplicate as new draft
                </button>
                {(isOwner || article.status !== "published") && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void act("archive", async () => {
                        await setArticleArchived(form({ archived: String(article.status !== "archived") }));
                        return { ok: true, message: article.status === "archived" ? "Restored to drafts." : "Archived." };
                      })
                    }
                    className="block text-muted hover:text-ink"
                  >
                    {article.status === "archived" ? "Restore from archive" : "Archive"}
                  </button>
                )}
                {(isOwner || !article.published) && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      if (window.confirm("Delete this article and all its revisions permanently?")) void deleteArticle(form({}));
                    }}
                    className="block text-red-300/90 hover:text-red-300"
                  >
                    Delete permanently
                  </button>
                )}
              </section>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
