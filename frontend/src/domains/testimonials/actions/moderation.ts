"use server";

import { refresh, revalidatePath } from "next/cache";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { TestimonialRepository } from "../server/TestimonialRepository";
import { TestimonialContract } from "../services/TestimonialContract";

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

export async function deleteTestimonial(formData: FormData): Promise<void> {
  const repo = await repository();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await repo.remove(id);
  refreshAfterChange();
}
