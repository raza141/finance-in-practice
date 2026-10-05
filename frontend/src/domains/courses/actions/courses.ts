"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import type { AdminUser } from "@/domains/admin/types";

import { BrochureStorage } from "../server/BrochureStorage";
import { CourseRepository, DuplicateSlugError } from "../server/CourseRepository";
import { CourseContract, type CourseFieldErrors } from "../services/CourseContract";
import { CoursePolicy } from "../services/CoursePolicy";

/**
 * Admin course management. Each action re-checks the session and the role:
 * server actions are public POST endpoints regardless of which page renders them.
 */

export interface CourseFormState {
  message?: string;
  errors?: CourseFieldErrors;
  /** Set after a successful save, so the editor can show "Saved". */
  savedAt?: number;
}

export type CourseIntent = "save" | "publish" | "unpublish";

const OWNER_ONLY = "Only an owner can publish, unpublish or edit a live course. Save your changes on a draft instead.";
const FIX_FIELDS = "Please fix the highlighted fields.";

async function session(): Promise<{ admin: AdminUser; repo: CourseRepository }> {
  const admin = await AdminAuth.require();
  const repo = CourseRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return { admin, repo };
}

/** Drop the cached public page(s) and sitemap, so a change is visible immediately rather than within the hour. */
function revalidateCourse(...slugs: (string | null)[]): void {
  for (const slug of new Set(slugs)) if (slug) revalidatePath(`/courses/${slug}`);
  revalidatePath("/courses");
  // The home page links its CFA/FRM cards to published course pages.
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
}

/** The editor posts the whole course as JSON in `payload`, plus an `intent`. */
export async function saveCourse(_state: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const { admin, repo } = await session();
  const intent = formData.get("intent") as CourseIntent;
  const id = formData.get("id");
  const existing = typeof id === "string" && id ? await repo.byId(id) : null;
  if (typeof id === "string" && id && !existing) return { message: "This course no longer exists." };

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { message: "The course could not be read. Reload the page and try again." };
  }
  const parsed = CourseContract.parse(payload);
  if (!parsed.ok) return { errors: parsed.errors, message: FIX_FIELDS };

  const wasLive = existing?.isActive ?? false;
  const willBeLive = intent === "publish" ? true : intent === "unpublish" ? false : wasLive;
  if (!CoursePolicy.canSave(admin, wasLive, willBeLive)) return { message: OWNER_ONLY };
  if (willBeLive) {
    const problems = CourseContract.publishProblems(parsed.input);
    if (Object.keys(problems).length > 0) return { errors: problems, message: "Not ready to publish yet." };
  }

  try {
    if (existing) {
      const previousSlug = await repo.update(existing.id, parsed.input, willBeLive, admin.id);
      if (previousSlug === null) return { message: "This course no longer exists." };
      revalidateCourse(previousSlug, parsed.input.slug);
    } else {
      const newId = await repo.create(parsed.input, willBeLive, admin.id);
      revalidateCourse(parsed.input.slug);
      redirect(`/admin/courses/${newId}`);
    }
  } catch (error) {
    if (error instanceof DuplicateSlugError) return { errors: { slug: error.message }, message: FIX_FIELDS };
    throw error;
  }
  refresh();
  const message = intent === "publish" ? "Published." : intent === "unpublish" ? "Unpublished: now a draft." : "Saved.";
  return { message, savedAt: Date.now() };
}

/** Publish/unpublish from the course list. Publishing runs the same readiness check as the editor. */
export async function setCourseActive(formData: FormData): Promise<void> {
  const { admin, repo } = await session();
  const id = formData.get("id");
  if (typeof id !== "string" || !CoursePolicy.canPublish(admin)) return;
  const active = formData.get("active") === "true";
  if (active) {
    const course = await repo.byId(id);
    // The list shows a "not ready" hint for these, so a silent no-op is enough here.
    if (!course || Object.keys(CourseContract.publishProblems(course)).length > 0) return;
  }
  revalidateCourse(await repo.setActive(id, active, admin.id));
  refresh();
}

export async function deleteCourse(formData: FormData): Promise<void> {
  const { admin, repo } = await session();
  const id = formData.get("id");
  if (typeof id !== "string" || !CoursePolicy.canDelete(admin)) return;
  revalidateCourse(await repo.remove(id));
  redirect("/admin/courses");
}

export async function uploadCourseBrochure(formData: FormData): Promise<{ url: string } | { error: string }> {
  await AdminAuth.require();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF." };
  const problem = await BrochureStorage.verify(file);
  if (problem) return { error: problem };
  try {
    return { url: await BrochureStorage.upload(file, CourseContract.slugify(String(formData.get("slug") ?? ""))) };
  } catch (error) {
    console.error("[courses] brochure upload failed", error);
    return { error: "Upload failed. Is BLOB_READ_WRITE_TOKEN set?" };
  }
}
