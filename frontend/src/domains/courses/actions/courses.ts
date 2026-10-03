"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { CourseRepository, DuplicateSlugError } from "../server/CourseRepository";
import { CourseContract, type CourseFieldErrors } from "../services/CourseContract";

/**
 * Admin course management. Each action re-checks the session: server actions
 * are public POST endpoints regardless of which page renders them.
 */

export interface CourseFormState {
  message?: string;
  errors?: CourseFieldErrors;
}

async function repository(): Promise<CourseRepository> {
  await AdminAuth.require();
  const repo = CourseRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

/** Drop the cached public page(s) and sitemap, so a change is visible immediately rather than within the hour. */
function revalidateCourse(...slugs: (string | null)[]): void {
  for (const slug of new Set(slugs)) if (slug) revalidatePath(`/courses/${slug}`);
  revalidatePath("/sitemap.xml");
}

export async function saveCourse(_state: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const repo = await repository();
  const parsed = CourseContract.parse(Object.fromEntries(formData));
  if (!parsed.ok) return { errors: parsed.errors, message: "Please fix the highlighted fields." };

  const id = formData.get("id");
  try {
    if (typeof id === "string" && id) {
      const previousSlug = await repo.update(id, parsed.input);
      if (previousSlug === null) return { message: "This course no longer exists." };
      revalidateCourse(previousSlug, parsed.input.slug);
    } else {
      await repo.create(parsed.input);
      revalidateCourse(parsed.input.slug);
    }
  } catch (error) {
    if (error instanceof DuplicateSlugError) return { errors: { slug: error.message }, message: "Please fix the highlighted fields." };
    throw error;
  }
  redirect("/admin/courses");
}

export async function setCourseActive(formData: FormData): Promise<void> {
  const repo = await repository();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  revalidateCourse(await repo.setActive(id, formData.get("active") === "true"));
  refresh();
}

export async function deleteCourse(formData: FormData): Promise<void> {
  const repo = await repository();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  revalidateCourse(await repo.remove(id));
  redirect("/admin/courses");
}
