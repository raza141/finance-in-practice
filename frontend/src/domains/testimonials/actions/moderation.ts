"use server";

import { refresh, revalidatePath } from "next/cache";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { TestimonialRepository } from "../server/TestimonialRepository";
import { TestimonialContract, TestimonialValidationError } from "../services/TestimonialContract";

/**
 * Admin moderation actions. Each one re-checks the session: server actions
 * are public POST endpoints regardless of which page renders them.
 */

async function repository(): Promise<TestimonialRepository> {
  await AdminAuth.require();
  const repo = TestimonialRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

/**
 * Invalidate the statically cached home page (it renders approved
 * testimonials) and re-render the admin page the action came from.
 */
function refreshAfterChange(): void {
  revalidatePath("/");
  refresh();
}

export async function setTestimonialStatus(formData: FormData): Promise<void> {
  const repo = await repository();
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || !TestimonialContract.isStatus(status)) return;
  await repo.setStatus(id, status);
  refreshAfterChange();
}

export type EditResult = { ok: true } | { ok: false; error: string } | null;

/** Fix a name or typo before (or after) approving. Same rules as the public form. */
export async function editTestimonial(_prev: EditResult, formData: FormData): Promise<EditResult> {
  const repo = await repository();
  const id = formData.get("id");
  if (typeof id !== "string") return { ok: false, error: "Missing testimonial id." };
  try {
    const edit = TestimonialContract.parseEdit(Object.fromEntries(formData));
    if (!(await repo.updateText(id, edit))) return { ok: false, error: "Testimonial not found." };
  } catch (error) {
    if (error instanceof TestimonialValidationError) {
      return { ok: false, error: error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." };
    }
    throw error;
  }
  refreshAfterChange();
  return { ok: true };
}

export async function deleteTestimonial(formData: FormData): Promise<void> {
  const repo = await repository();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await repo.remove(id);
  refreshAfterChange();
}
