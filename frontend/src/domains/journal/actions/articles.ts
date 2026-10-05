"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import type { AdminUser } from "@/domains/admin/types";
import { PhotoStorage } from "@/domains/team/server/PhotoStorage";

import { ArticleRepository, type AutosaveResult } from "../server/ArticleRepository";
import { ArticleReviewer } from "../server/ArticleReviewer";
import { ArticleContract } from "../services/ArticleContract";
import { ArticlePolicy } from "../services/ArticlePolicy";
import { ArticleValidator, type ValidationIssue } from "../services/ArticleValidator";
import { JournalFramework } from "../services/JournalFramework";
import { JournalTaxonomy } from "../services/JournalTaxonomy";
import type { AiReview, ArticleRecord } from "../types";

/**
 * Research article management. Every action re-checks the session and the
 * caller's right to the article: server actions are public POST endpoints.
 */

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string; issues?: ValidationIssue[] };

async function repository(): Promise<{ admin: AdminUser; repo: ArticleRepository }> {
  const admin = await AdminAuth.require();
  const repo = ArticleRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return { admin, repo };
}

/** The article, if the signed-in admin may edit it. */
async function editable(id: unknown): Promise<{ admin: AdminUser; repo: ArticleRepository; article: ArticleRecord } | null> {
  const { admin, repo } = await repository();
  if (typeof id !== "string") return null;
  const article = await repo.byId(id);
  return article && ArticlePolicy.canEdit(admin, article) ? { admin, repo, article } : null;
}

/** Drop cached public pages so a change shows immediately rather than at the next revalidation. */
function revalidateJournal(...slugs: (string | null | undefined)[]): void {
  for (const slug of new Set(slugs)) if (slug) revalidatePath(`/journal/${slug}`);
  revalidatePath("/journal");
  revalidatePath("/sitemap.xml");
}

export async function createArticle(formData: FormData): Promise<void> {
  const { admin, repo } = await repository();
  const format = formData.get("format");
  if (!JournalTaxonomy.isFormat(format)) return;
  const id = await repo.create(admin.id, JournalFramework.newDocument(format, `draft-${crypto.randomUUID().slice(0, 8)}`));
  redirect(`/admin/journal/${id}`);
}

export async function autosaveArticle(
  id: string,
  version: number,
  json: string,
): Promise<AutosaveResult | { status: "invalid"; error: string } | { status: "forbidden" }> {
  const ctx = await editable(id);
  if (!ctx) return { status: "forbidden" };
  const parsed = ArticleContract.parseJson(json);
  if (!parsed.ok) return { status: "invalid", error: parsed.error };
  const result = await ctx.repo.autosave(id, version, parsed.doc);
  // An unpublished draft has nothing public to refresh; a live one only changes on publish.
  return result;
}

/** Cmd+S: a named restore point in the revision history. */
export async function checkpointArticle(id: string): Promise<ActionResult> {
  const ctx = await editable(id);
  if (!ctx) return { ok: false, message: "You can't edit this article." };
  await ctx.repo.checkpoint(id, ctx.admin.id);
  return { ok: true, message: "Checkpoint saved." };
}

/** Validate the saved draft against the publishing checklist. */
async function readiness(repo: ArticleRepository, article: ArticleRecord): Promise<ValidationIssue[]> {
  return ArticleValidator.errors(article.draft, { publishedSlugs: await repo.publishedSlugs() });
}

/**
 * Owners only: make the saved draft live now, or scheduled when `publishAt`
 * (ISO) is in the future. `version` must match the draft the owner reviewed.
 */
export async function publishArticle(id: string, version: number, publishAt: string | null): Promise<ActionResult> {
  const ctx = await editable(id);
  if (!ctx) return { ok: false, message: "You can't edit this article." };
  if (!ArticlePolicy.canPublish(ctx.admin)) return { ok: false, message: "Only an owner can publish. Submit it for review instead." };
  if (ctx.article.version !== version) return { ok: false, message: "The article changed since you opened it. Reload, check, then publish." };

  const issues = await readiness(ctx.repo, ctx.article);
  if (issues.length > 0) return { ok: false, message: `Fix ${issues.length} issue${issues.length === 1 ? "" : "s"} before publishing.`, issues };

  let at: Date | null = null;
  if (publishAt) {
    at = new Date(publishAt);
    if (Number.isNaN(at.getTime())) return { ok: false, message: "That publish date is not valid." };
  }
  const slug = await ctx.repo.publish(id, version, ctx.admin.id, at);
  if (!slug) return { ok: false, message: "The article changed while publishing. Reload and try again." };
  revalidateJournal(slug);
  refresh();
  const scheduled = at !== null && at.getTime() > Date.now();
  return { ok: true, message: scheduled ? `Scheduled for ${at!.toUTCString()}.` : "Published." };
}

/** Editors hand a finished draft to an owner. The same checklist applies. */
export async function submitArticle(id: string, version: number): Promise<ActionResult> {
  const ctx = await editable(id);
  if (!ctx) return { ok: false, message: "You can't edit this article." };
  if (ctx.article.version !== version) return { ok: false, message: "The article changed since you opened it. Reload and try again." };
  const issues = await readiness(ctx.repo, ctx.article);
  if (issues.length > 0) return { ok: false, message: `Fix ${issues.length} issue${issues.length === 1 ? "" : "s"} before submitting.`, issues };
  if (!(await ctx.repo.submit(id, version, ctx.admin.id))) return { ok: false, message: "The article changed while submitting. Reload and try again." };
  refresh();
  return { ok: true, message: "Submitted for review." };
}

export async function requestChanges(formData: FormData): Promise<void> {
  const ctx = await editable(formData.get("id"));
  if (!ctx || !ArticlePolicy.canPublish(ctx.admin)) return;
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000) || "Please revise and resubmit.";
  await ctx.repo.requestChanges(ctx.article.id, note);
  refresh();
}

export async function unpublishArticle(formData: FormData): Promise<void> {
  const ctx = await editable(formData.get("id"));
  if (!ctx || !ArticlePolicy.canPublish(ctx.admin)) return;
  revalidateJournal(await ctx.repo.unpublish(ctx.article.id));
  refresh();
}

export async function setArticleArchived(formData: FormData): Promise<void> {
  const ctx = await editable(formData.get("id"));
  if (!ctx) return;
  const archived = formData.get("archived") === "true";
  // Archiving takes a live article down, which is a publishing decision.
  if (ctx.article.status === "published" && !ArticlePolicy.canPublish(ctx.admin)) return;
  revalidateJournal(await ctx.repo.setArchived(ctx.article.id, archived));
  refresh();
}

export async function deleteArticle(formData: FormData): Promise<void> {
  const ctx = await editable(formData.get("id"));
  if (!ctx) return;
  if (ctx.article.published && !ArticlePolicy.canPublish(ctx.admin)) return;
  revalidateJournal(await ctx.repo.remove(ctx.article.id));
  redirect("/admin/journal");
}

export async function duplicateArticle(formData: FormData): Promise<void> {
  const ctx = await editable(formData.get("id"));
  if (!ctx) return;
  const id = await ctx.repo.duplicate(ctx.article.id, ctx.admin.id);
  if (id) redirect(`/admin/journal/${id}`);
}

export async function restoreRevision(formData: FormData): Promise<void> {
  const ctx = await editable(formData.get("id"));
  const revisionId = formData.get("revisionId");
  if (!ctx || typeof revisionId !== "string") return;
  await ctx.repo.restore(ctx.article.id, revisionId, ctx.admin.id);
  redirect(`/admin/journal/${ctx.article.id}`);
}

export async function runAiReview(id: string): Promise<{ ok: true; review: AiReview } | { ok: false; message: string }> {
  const ctx = await editable(id);
  if (!ctx) return { ok: false, message: "You can't edit this article." };
  if (!ArticleReviewer.isConfigured()) return { ok: false, message: "AI review is off: set ANTHROPIC_API_KEY in the environment." };
  try {
    const review = await ArticleReviewer.review(ctx.article.draft);
    await ctx.repo.setAiReview(id, review);
    return { ok: true, review };
  } catch (error) {
    console.error("[journal] AI review failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "AI review failed. Try again." };
  }
}

export async function uploadArticleImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  await AdminAuth.require();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  const problem = await PhotoStorage.verify(file);
  if (problem) return { error: problem };
  try {
    return { url: await PhotoStorage.upload(file, "journal/figure") };
  } catch (error) {
    console.error("[journal] image upload failed", error);
    return { error: "Upload failed. Is BLOB_READ_WRITE_TOKEN set?" };
  }
}
