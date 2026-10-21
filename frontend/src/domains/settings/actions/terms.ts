"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { TermsRepository } from "../server/TermsRepository";
import { TermsText } from "../services/TermsText";

/** Publishes a new version of the terms: /terms shows it, and each student accepts it before their next booking. */
export async function publishTerms(formData: FormData): Promise<void> {
  const admin = await AdminAuth.requireOwner();
  const repo = TermsRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  const body = String(formData.get("body") ?? "").trim();
  const problem = TermsText.check(body);
  if (problem) redirect(`/admin/settings/terms?error=${encodeURIComponent(problem)}`);
  const latest = await repo.latest();
  if (latest?.body.trim() === body) redirect("/admin/settings/terms?notice=unchanged");
  await repo.publish(body, admin.id);
  revalidatePath("/terms");
  redirect("/admin/settings/terms?notice=published");
}
